/**
 * @file src/services/llm_service.ts
 * @description Bertanggung jawab untuk melakukan panggilan API, sekarang dengan dukungan tool_choice.
 */
import axios from 'axios';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Message } from '../adapters/BaseAdapter.js';
import { ToolDefinition, ProviderConfig } from '../config/schema.js';
import { ChatOptions } from '../types/index.js';
import {
  ContentExtractionError, InvalidApiKeyError, RateLimitError,
  InsufficientQuotaError, ServiceUnavailableError,
} from '../config/errors.js';

const toGeminiHistory = (history: Message[]): object[] => {
  return history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(turn => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    }));
};

const openAICompatiblePayload = (h: Message[], m: string, t?: ToolDefinition[], toolChoice?: ChatOptions['toolChoice']): object => ({
  model: m,
  messages: h,
  ...(t && t.length > 0 && {
    tools: t.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters)
      }
    })),
    // Tambahkan tool_choice jika ada
    tool_choice: toolChoice || 'auto'
  })
});

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

async function generateNextMessage(
  history: Message[],
  provider: string,
  apiKey: string,
  modelName: string,
  providerConfig: ProviderConfig,
  tools?: ToolDefinition[],
  toolChoice?: ChatOptions['toolChoice']
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
      data: providerConfig.buildPayload(history, modelName, tools, toolChoice),
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
        if (status === 400) {
            throw new ServiceUnavailableError(`Layanan ${provider} merespons dengan Bad Request (400), cek payload atau izin kunci API Anda.`);
        }
    }
    if (error instanceof Error) {
        throw new ServiceUnavailableError(`Layanan ${provider} gagal merespons: ${error.message}`);
    }
    throw new ServiceUnavailableError(`Layanan ${provider} tidak tersedia atau gagal merespons.`);
  }
}

// Fungsi generateStream tidak perlu diubah karena kita akan menggunakan simulate stream di responder
// untuk konsistensi setelah tool call.

export default { generateNextMessage };