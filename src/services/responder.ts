/**
 * @file src/services/responder.ts
 * @description Orkestrator utama yang mengelola logika fallback, rotasi kunci, dan eksekusi tool.
 */
import llmService from './llm_service.js';
import apiManager from '../core/api_manager.js';
import { createLogger } from '../core/logger.js';
import { Message } from '../adapters/BaseAdapter.js';
import { CerebrumConfig, ToolDefinition, ProviderConfig } from '../config/schema.js';
import { 
    AllProvidersFailedError, 
    InvalidApiKeyError, 
    InsufficientQuotaError, 
    RateLimitError, 
    ServiceUnavailableError 
} from '../config/errors.js';
import { ToolImplementation } from '../types/index.js';

const log = createLogger('Responder');

/**
 * Mencoba mendapatkan pesan balasan dari AI dengan menjalankan strategi fallback.
 * @param history Riwayat percakapan yang akan dikirim.
 * @param config Konfigurasi instance Cerebrum.
 * @param allProviderConfigs Peta lengkap dari semua provider yang tersedia (bawaan + kustom).
 * @param tools Definisi tools yang tersedia.
 * @returns Objek berisi pesan balasan dari AI dan provider yang berhasil merespons.
 * @throws {AllProvidersFailedError} Jika semua provider dalam strategi gagal.
 */
async function generateNextMessage(
  history: Message[],
  config: CerebrumConfig,
  allProviderConfigs: Record<string, ProviderConfig>,
  tools?: ToolDefinition[]
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
      if (!apiKey && provider !== 'EchoAI') { // EchoAI tidak butuh kunci
        log.warn(`Tidak ada lagi kunci AKTIF untuk ${provider}.`);
        break; 
      }

      try {
        log.info(`Mencoba provider ${provider.toUpperCase()} dengan kunci ...${apiKey ? apiKey.slice(-4) : 'NONE'}`);
        const message = await llmService.generateNextMessage(history, provider, apiKey!, modelName, providerConfig, tools);
        log.info(`Sukses mendapatkan pesan dari ${provider.toUpperCase()}`);
        return { message, provider };
      } catch (error) {
        lastError = error as Error;
        log.warn(`Kunci ...${apiKey ? apiKey.slice(-4) : 'NONE'} gagal: ${lastError.name} - ${lastError.message}`);
        
        if (apiKey) {
            excludedKeysThisRequest.add(apiKey);
            if (error instanceof InvalidApiKeyError) await apiManager.updateKeyStatus(apiKey, 'invalid');
            else if (error instanceof InsufficientQuotaError) await apiManager.updateKeyStatus(apiKey, 'quota_exhausted');
            else if (error instanceof RateLimitError) await apiManager.updateKeyStatus(apiKey, 'rate_limited');
            else {
                // Untuk error seperti ServiceUnavailable, kita anggap provider-nya yang bermasalah, bukan kuncinya.
                break; // Keluar dari loop kunci dan coba provider berikutnya.
            }
        } else {
            // Jika provider tanpa kunci gagal, langsung coba provider berikutnya.
            break;
        }
      }
    }
    await apiManager.demoteProvider(provider);
  }

  throw new AllProvidersFailedError('Semua provider gagal merespons setelah mencoba semua strategi fallback.', lastError);
}

/**
 * Mengeksekusi tool yang diminta oleh AI.
 * @param toolCalls Array berisi permintaan tool call dari AI.
 * @param implementations Peta berisi fungsi-fungsi implementasi tool.
 * @returns Array berisi pesan hasil eksekusi tool.
 */
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

    log.info(`Mengeksekusi tool: ${functionName} dengan argumen:`, functionArgs);
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

/**
 * Men-stream respons teks final setelah semua proses (termasuk tool calls) selesai.
 */
async function* streamFinalResponse(
  history: Message[],
  messageWithContent: Message,
  provider: string,
  config: CerebrumConfig,
  allProviderConfigs: Record<string, ProviderConfig>,
): AsyncGenerator<string, void, unknown> {
    const providerConfig = allProviderConfigs[provider];
    if (!providerConfig) return;

    // Untuk provider sejati, kita bisa memanggil llm_service.generateStream di sini.
    // Untuk kesederhanaan dan efisiensi (menghindari panggilan API kedua),
    // kita simulasikan stream dari konten yang sudah ada.
    if(messageWithContent.content) {
        const words = messageWithContent.content.split(' ');
        for(let i=0; i<words.length; i++) {
            yield words[i] + (i === words.length-1 ? '' : ' ');
            // Jeda kecil untuk membuat efek "mengetik"
            await new Promise(res => setTimeout(res, 30));
        }
    }
}

export default { generateNextMessage, executeTools, streamFinalResponse };