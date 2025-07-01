import axios from 'axios';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Message } from '../adapters/BaseAdapter.js';
import { ToolDefinition } from '../config/schema.js';
import {
  ContentExtractionError, InvalidApiKeyError, RateLimitError,
  InsufficientQuotaError, ServiceUnavailableError,
} from '../config/errors.js';

type PayloadBuilder = (history: Message[], modelName: string, tools?: ToolDefinition[]) => object;
type MessageExtractor = (responseData: any) => Message | null;

interface ProviderConfig {
  getEndpoint: (modelName: string) => string;
  buildPayload: PayloadBuilder;
  extractMessage: MessageExtractor;
}

const toGeminiHistory = (history: Message[]) => history.filter(m => m.role !== 'system').map(turn => ({
  role: turn.role === 'assistant' ? 'model' : 'user',
  parts: [{ text: turn.content }],
}));

const openAICompatiblePayload = (h: Message[], m: string, t?: ToolDefinition[]) => ({
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
    }))
  })
});

const providerConfigs: Record<string, ProviderConfig> = {
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
  // TAMBAHKAN BLOK INI
  perplexity: {
    getEndpoint: () => 'https://api.perplexity.ai/chat/completions',
    buildPayload: openAICompatiblePayload,
    extractMessage: (res) => res.data?.choices?.[0]?.message || null,
  },
  // Tambahkan juga gemini jika Anda ingin menggunakannya
  gemini: {
    getEndpoint: (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
    buildPayload: (h) => ({ contents: toGeminiHistory(h.filter(m => m.role !== 'system')) }),
    extractMessage: (res) => ({ role: 'assistant', content: res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '' }),
  },
};

async function generateNextMessage(
  history: Message[],
  provider: string,
  apiKey: string,
  modelName: string,
  tools?: ToolDefinition[]
): Promise<Message> {
  const config = providerConfigs[provider];
  if (!config) throw new ServiceUnavailableError(`Provider '${provider}' tidak dikonfigurasi.`);
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const url = config.getEndpoint(modelName);
  headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const response = await axios({
      method: 'POST', url, headers,
      data: config.buildPayload(history, modelName, tools),
      timeout: 60000,
    });
    const message = config.extractMessage(response);
    if (!message) throw new ContentExtractionError(`Gagal mengekstrak pesan dari provider ${provider}.`);
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
    throw new ServiceUnavailableError(`Layanan ${provider} tidak tersedia atau gagal merespons.`);
  }
}

async function* generateStream(
    history: Message[],
    provider: string,
    apiKey: string,
    modelName: string,
    tools?: ToolDefinition[]
): AsyncGenerator<string, void, unknown> {
  const config = providerConfigs[provider];
  if (!config) throw new ServiceUnavailableError(`Provider '${provider}' tidak dikonfigurasi.`);
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' };
  const url = config.getEndpoint(modelName);
  headers['Authorization'] = `Bearer ${apiKey}`;
  
  try {
    const response = await axios({
      method: 'POST', url, headers,
      data: { ...config.buildPayload(history, modelName, tools), stream: true },
      responseType: 'stream',
    });
    
    for await (const buffer of response.data) {
      const sseLines: string[] = buffer.toString('utf-8').split('\n').filter((line: string) => line.trim().length > 0);
      for (const sseLine of sseLines) {
        if (sseLine.startsWith('data: ')) {
          const dataContent = sseLine.substring(6);
          if (dataContent.trim() === '[DONE]') continue;
          try {
            const json = JSON.parse(dataContent);
            const chunk = json.choices?.[0]?.delta?.content || '';
            if (chunk) yield chunk;
          } catch (e) {
             // Abaikan error parsing
          }
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
