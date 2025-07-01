import llmService from './llm_service.js';
import apiManager from '../core/api_manager.js';
import { createLogger } from '../core/logger.js';
import { Message } from '../adapters/BaseAdapter.js';
import { CerebrumConfig, ToolDefinition } from '../config/schema.js';
import { AllProvidersFailedError, InvalidApiKeyError, InsufficientQuotaError, RateLimitError } from '../config/errors.js';
import { ToolImplementation } from '../types/index.js';

const log = createLogger('Responder');

async function generateNextMessage(
  history: Message[],
  config: CerebrumConfig,
  tools?: ToolDefinition[]
): Promise<{ message: Message; provider: string }> {
  const providerPriority = apiManager.getState().providerPriority;
  const excludedKeysThisRequest = new Set<string>();
  let lastError: Error | undefined;

  for (const provider of providerPriority) {
    const modelName = config.modelDefaults[provider];
    if (!modelName) {
      log.warn(`Tidak ada model default untuk provider ${provider}. Melewati.`);
      continue;
    }
    while (true) {
      const apiKey = apiManager.getNextAvailableKey(provider, excludedKeysThisRequest);
      if (!apiKey) break;

      try {
        log.info(`Mencoba provider ${provider.toUpperCase()} dengan kunci ...${apiKey.slice(-4)}`);
        const message = await llmService.generateNextMessage(history, provider, apiKey, modelName, tools);
        log.info(`Sukses mendapatkan pesan dari ${provider.toUpperCase()}`);
        return { message, provider };
      } catch (error) {
        lastError = error as Error;
        log.warn(`Kunci ...${apiKey.slice(-4)} gagal: ${lastError.name} - ${lastError.message}`);
        excludedKeysThisRequest.add(apiKey);
        if (error instanceof InvalidApiKeyError) await apiManager.updateKeyStatus(apiKey, 'invalid');
        else if (error instanceof InsufficientQuotaError) await apiManager.updateKeyStatus(apiKey, 'quota_exhausted');
        else if (error instanceof RateLimitError) await apiManager.updateKeyStatus(apiKey, 'rate_limited');
        else break;
      }
    }
    await apiManager.demoteProvider(provider);
  }
  throw new AllProvidersFailedError('Semua provider gagal merespons.', lastError);
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
    if (implementation) {
      try {
        result = await Promise.resolve(implementation(functionArgs));
      } catch (e) {
        result = { error: (e as Error).message };
      }
    } else {
      result = { error: `Tool '${functionName}' tidak memiliki implementasi.` };
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
  history: Message[],
  messageWithContent: Message,
  provider: string,
  config: CerebrumConfig,
): AsyncGenerator<string, void, unknown> {
    const modelName = config.modelDefaults[provider];
    const apiKey = apiManager.getNextAvailableKey(provider, new Set());
    if (!apiKey) return;
    
    const streamHistory: Message[] = [...history, messageWithContent];
    
    if(messageWithContent.content) {
        const words = messageWithContent.content.split(' ');
        for(let i=0; i<words.length; i++) {
            yield words[i] + (i === words.length-1 ? '' : ' ');
            await new Promise(res => setTimeout(res, 25));
        }
    }
}

export default { generateNextMessage, executeTools, streamFinalResponse };