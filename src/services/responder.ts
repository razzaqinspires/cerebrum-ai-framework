/**
 * @file src/services/responder.ts
 * @description Orkestrator utama yang mengelola logika fallback, rotasi kunci, retry, dan eksekusi tool.
 */
import llmService from './llm_service.js';
import apiManager from '../core/api_manager.js';
import { createLogger } from '../core/logger.js';
import { Message } from '../adapters/BaseAdapter.js';
import { CerebrumConfig, ToolDefinition, ProviderConfig } from '../config/schema.js';
import { AllProvidersFailedError, InvalidApiKeyError, InsufficientQuotaError, RateLimitError, ServiceUnavailableError } from '../config/errors.js';
import { ToolImplementation, ChatOptions } from '../types/index.js';

const log = createLogger('Responder');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateNextMessage(
  history: Message[],
  config: CerebrumConfig,
  allProviderConfigs: Record<string, ProviderConfig>,
  tools?: ToolDefinition[],
  toolChoice?: ChatOptions['toolChoice']
): Promise<{ message: Message; provider: string }> {
  const providerPriority = apiManager.getState().providerPriority;
  const excludedKeysThisRequest = new Set<string>();
  let lastError: Error | undefined;

  for (const provider of providerPriority) {
    const providerConfig = allProviderConfigs[provider];
    const modelName = config.modelDefaults[provider];

    if (!providerConfig || !modelName) {
      log.warn(`Definisi atau model default untuk provider '${provider}' tidak ditemukan. Melewati.`);
      continue;
    }
    
    while (true) {
      const apiKey = apiManager.getNextAvailableKey(provider, excludedKeysThisRequest);
      if (!apiKey && providerConfig.getEndpoint().startsWith('http')) {
        log.warn(`Tidak ada lagi kunci AKTIF untuk ${provider}.`);
        break; 
      }

      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          log.info(`Mencoba provider ${provider.toUpperCase()} dengan kunci ...${apiKey ? apiKey.slice(-4) : 'NONE'} (Percobaan ${attempt}/${MAX_RETRIES})`);
          
          const message = await llmService.generateNextMessage(history, provider, apiKey!, modelName, providerConfig, tools, toolChoice);
          
          log.info(`Sukses mendapatkan pesan dari ${provider.toUpperCase()}`);
          await apiManager.setHighestPriority(provider);
          return { message, provider };

        } catch (error) {
          lastError = error as Error;
          
          if (error instanceof ServiceUnavailableError && attempt < MAX_RETRIES) {
              const delay = 500 * attempt;
              log.warn(`Layanan ${provider} gagal. Mencoba lagi dalam ${delay}ms...`);
              await sleep(delay);
              continue;
          }
          
          log.warn(`Kunci ...${apiKey ? apiKey.slice(-4) : 'NONE'} gagal total: ${lastError.name} - ${lastError.message}`);
          if (apiKey) {
            excludedKeysThisRequest.add(apiKey);
            if (error instanceof InvalidApiKeyError) await apiManager.updateKeyStatus(apiKey, 'invalid');
            else if (error instanceof InsufficientQuotaError) await apiManager.updateKeyStatus(apiKey, 'quota_exhausted');
            else if (error instanceof RateLimitError) await apiManager.updateKeyStatus(apiKey, 'rate_limited');
          }
          break;
        }
      }
    }
    await apiManager.demoteProvider(provider);
  }
  throw new AllProvidersFailedError('Semua provider gagal merespons setelah mencoba semua strategi fallback.', lastError);
}

async function executeTools(
  toolCalls: any[],
  implementations: Record<string, ToolImplementation>
): Promise<Message[]> {
  const results: Message[] = [];
  for (const toolCall of toolCalls) {
    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments);
    const implementation = implementations[functionName];
    let result;

    log.info(`Mengeksekusi tool: ${functionName}`, functionArgs);
    if (implementation) {
      try {
        result = await Promise.resolve(implementation(functionArgs));
      } catch (e) {
        result = { error: (e as Error).message };
        log.error(`Error saat eksekusi tool '${functionName}':`, e);
      }
    } else {
      result = { error: `Tool '${functionName}' tidak memiliki implementasi.` };
      log.error(`Implementasi untuk tool '${functionName}' tidak ditemukan.`);
    }
    results.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: functionName,
      content: JSON.stringify(result),
    });
  }
  return results;
}

async function* streamFinalResponse(
  messageWithContent: Message,
): AsyncGenerator<string, void, unknown> {
    if(messageWithContent.content) {
        const words = messageWithContent.content.split(' ');
        for(let i=0; i<words.length; i++) {
            yield words[i] + (i === words.length-1 ? '' : ' ');
            await new Promise(res => setTimeout(res, 30));
        }
    }
}

export default { generateNextMessage, executeTools, streamFinalResponse };