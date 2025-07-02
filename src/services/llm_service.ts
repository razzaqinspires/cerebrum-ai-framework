/**
 * @file src/services/llm_service.ts
 * @description Bertanggung jawab untuk melakukan panggilan API langsung ke provider LLM.
 * Melempar error spesifik saat terjadi kegagalan dan mendukung provider kustom.
 */
import axios from 'axios';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Message } from '../adapters/BaseAdapter.js';
import { ToolDefinition, ProviderConfig } from '../config/schema.js';
import {
  ContentExtractionError,
  InvalidApiKeyError,
  RateLimitError,
  InsufficientQuotaError,
  ServiceUnavailableError,
} from '../config/errors.js';

// --- Helper Functions ---

/**
 * Mengubah riwayat percakapan ke format yang dimengerti oleh API Gemini.
 */
const toGeminiHistory = (history: Message[]): object[] => {
    // Gemini tidak menggunakan system prompt dalam `contents`.
    // Dan role asisten adalah 'model'.
    return history
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(turn => ({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.content }],
        }));
};

/**
 * Membangun payload untuk API yang kompatibel dengan OpenAI (OpenAI, Groq, Perplexity).
 */
const openAICompatiblePayload = (history: Message[], modelName: string, tools?: ToolDefinition[]): object => ({
  model: modelName,
  messages: history,
  ...(tools && tools.length > 0 && {
    tools: tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters)
      }
    }))
  })
});

/**
 * Mengekstrak chunk dari Server-Sent Event (SSE) stream.
 */
function parseSseChunk(sseLine: string): string | null {
  if (sseLine.startsWith('data: ')) {
    const dataContent = sseLine.substring(6);
    if (dataContent.trim() === '[DONE]') {
      return null;
    }
    try {
      const json = JSON.parse(dataContent);
      return json.choices?.[0]?.delta?.content || '';
    } catch (e) {
      return '';
    }
  }
  return '';
}


// --- Konfigurasi Provider Bawaan ---

/**
 * Objek ini berisi konfigurasi untuk provider yang didukung secara default oleh framework.
 * Diekspor agar bisa digabungkan dengan `customProviders` di kelas Cerebrum.
 */
export const builtInProviderConfigs: Record<string, ProviderConfig> = {
  openai: {
    getEndpoint: () => 'https://api.openai.com/v1/chat/completions',
    buildPayload: openAICompatiblePayload,
    extractMessage: (res) => res.data?.choices?.[0]?.message || null,
  },
  groq: {
    getEndpoint: () => 'https://api.groq.com/openai/v1/chat/completions',
    buildPayload: openAICompatiblePayload,
    extractMessage: (res) => res.data?.choices?.[0]?.message || null,
  },
  perplexity: {
    getEndpoint: () => 'https://api.perplexity.ai/chat/completions',
    buildPayload: openAICompatiblePayload,
    extractMessage: (res) => res.data?.choices?.[0]?.message || null,
  },
  gemini: {
    getEndpoint: (modelName) => `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
    buildPayload: (history, modelName) => ({ contents: toGeminiHistory(history) }),
    extractMessage: (res) => ({ role: 'assistant', content: res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '' }),
  },
};


// --- Fungsi Eksekusi API ---

/**
 * Menjalankan satu kali panggilan API (non-streaming) ke provider yang dipilih.
 */
async function generateNextMessage(
  history: Message[],
  provider: string,
  apiKey: string,
  modelName: string,
  providerConfig: ProviderConfig,
  tools?: ToolDefinition[]
): Promise<Message> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let url = providerConfig.getEndpoint(modelName);

  if (provider === 'gemini') {
      url = `${url}?key=${apiKey}`;
  } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await axios({
      method: 'POST',
      url,
      headers,
      data: providerConfig.buildPayload(history, modelName, tools),
      timeout: 60000,
    });
    const message = providerConfig.extractMessage(response);
    if (!message || (message.content === null && !message.tool_calls)) {
      throw new ContentExtractionError(`Gagal mengekstrak konten atau tool_calls dari provider ${provider}.`);
    }
    return message;
  } catch (error) {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorInfo = error.response?.data?.error;
        if (status === 401 || status === 403) throw new InvalidApiKeyError(`Kunci API ditolak oleh ${provider}.`);
        if (status === 429) {
            if (errorInfo?.type === 'insufficient_quota') throw new InsufficientQuotaError(`Kouta habis untuk provider ${provider}.`);
            throw new RateLimitError(`Terkena rate limit dari ${provider}.`);
        }
    }
    if (error instanceof Error) {
        throw new ServiceUnavailableError(`Layanan ${provider} gagal merespons: ${error.message}`);
    }
    throw new ServiceUnavailableError(`Layanan ${provider} tidak tersedia atau gagal merespons.`);
  }
}

/**
 * Menjalankan panggilan API streaming ke provider yang dipilih.
 */
async function* generateStream(
    history: Message[],
    provider: string,
    apiKey: string,
    modelName: string,
    providerConfig: ProviderConfig,
    tools?: ToolDefinition[]
): AsyncGenerator<string, void, unknown> {
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' };
  let url = providerConfig.getEndpoint(modelName);
  headers['Authorization'] = `Bearer ${apiKey}`;
  
  try {
    const response = await axios({
      method: 'POST', url, headers,
      data: { ...providerConfig.buildPayload(history, modelName, tools), stream: true },
      responseType: 'stream',
      timeout: 60000,
    });
    
    for await (const buffer of response.data) {
      const sseLines: string[] = buffer.toString('utf-8').split('\n').filter((line: string) => line.trim().length > 0);
      for (const sseLine of sseLines) {
        const chunk = parseSseChunk(sseLine);
        if (chunk) {
          yield chunk;
        }
      }
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401 || status === 403) throw new InvalidApiKeyError(`Kunci API ditolak oleh ${provider}.`);
    }
    throw new ServiceUnavailableError(`Layanan ${provider} gagal saat streaming.`);
  }
}

export default { generateNextMessage, generateStream };