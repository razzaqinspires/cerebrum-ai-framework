/**
 * @file examples/app-config.ts
 * @description File konfigurasi terpusat yang komprehensif untuk aplikasi contoh.
 * Menunjukkan cara mendaftarkan semua provider, tools, dan plugin.
 */

import { z } from 'zod';
import { 
    Plugin, 
    ToolImplementation, 
    HookContext, 
    Message, 
    CerebrumConfig, 
    ProviderConfig, 
    CorePromptConfig 
} from '../src/index.js'; // Impor dari src untuk development
import chalk from 'chalk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PerformanceTrackerPlugin } from '../src/plugins/PerformanceTracker.js';

// --- 1. KUNCI API ---
// Ganti dengan kunci API asli Anda. Untuk keamanan, muat ini dari environment variables di proyek nyata.
const myApiKeys = {
    groq: [process.env.GROQ_API_KEY || "gsk_..."],
    openai: [process.env.OPENAI_API_KEY || "sk-..."],
    gemini: [process.env.GEMINI_API_KEY || "..."],
    perplexity: [process.env.PERPLEXITY_API_KEY || "pplx-..."],
    anthropic: [process.env.ANTHROPIC_API_KEY || "claude_api_key..."],
    mistral: [process.env.MISTRAL_API_KEY || "mistral_api_key..."],
};


// --- 2. DEFINISI & IMPLEMENTASI PROVIDER KUSTOM ---

// Helper untuk payload yang kompatibel dengan OpenAI
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

// Definisi untuk Mistral AI
const mistralProviderConfig: ProviderConfig = {
    getEndpoint: () => 'https://api.mistral.ai/v1/chat/completions',
    buildPayload: openAICompatiblePayload,
    extractMessage: (res) => res.data?.choices?.[0]?.message || null,
};

// Definisi untuk Anthropic (Claude)
const anthropicProviderConfig: ProviderConfig = {
    getEndpoint: () => 'https://api.anthropic.com/v1/messages',
    buildPayload: (history, modelName, tools) => ({
      model: modelName,
      max_tokens: 4096,
      system: history.find(m => m.role === 'system')?.content || '',
      messages: history.filter(m => m.role !== 'system'),
    }),
    extractMessage: (res) => ({
        role: 'assistant',
        content: res.data?.content?.[0]?.text || '',
    }),
};


// --- 3. DEFINISI & IMPLEMENTASI TOOLS ---

const myTools = [
  {
    name: 'cekStatusPemesanan',
    description: 'Cek status pemesanan berdasarkan nomor ID pesanan.',
    parameters: z.object({
      orderId: z.string().describe('Nomor ID unik dari pesanan, contoh: "ORD-12345"'),
    }),
  },
];

const myToolImplementations: Record<string, ToolImplementation> = {
  cekStatusPemesanan: async ({ orderId }: { orderId: string }) => {
    console.log(chalk.yellow(`[Tool Executed: cekStatusPemesanan] Order ID: ${orderId}`));
    if (orderId === 'ORD-12345') {
      return { status: 'Sedang Dikirim', estimasi_tiba: `Jumat, 4 Juli 2025` };
    }
    return { status: 'Tidak Ditemukan', estimasi_tiba: null };
  },
};


// --- 4. DEFINISI PLUGINS ---

export const myPlugins: Plugin[] = [
  new PerformanceTrackerPlugin(), // Plugin pelacak performa yang kita buat
  {
    name: 'RequestTimer',
    onPreChat: (ctx: HookContext) => {
        // @ts-ignore
        ctx.startTime = Date.now();
    },
    onChatComplete: (ctx: HookContext) => {
        // @ts-ignore
        const duration = Date.now() - ctx.startTime;
        console.log(chalk.gray(`[RequestTimer] Waktu proses untuk sesi '${ctx.sessionId}': ${duration} ms`));
    }
  }
];


// --- DEFINISI PROMPT INTI YANG DISEMPURNAKAN ---
export const corePrompt: CorePromptConfig = {
    // Ini adalah instruksi "jiwa" dari AI kita.
    content: "Anda adalah Cerebrum, sebuah framework kecerdasan buatan canggih yang diciptakan oleh Arifi Razzaq di Indonesia. Anda BUKAN model LLM seperti GPT atau Llama, melainkan sebuah sistem orkestrasi yang cerdas yang menggunakan model-model tersebut untuk memberikan jawaban. Saat menjawab pertanyaan tentang identitas Anda, selalu sebutkan nama Anda 'Cerebrum' dan pencipta Anda 'Arifi Razzaq'. Jangan pernah mengklaim Anda adalah model dari OpenAI, Google, atau Groq. Anda adalah entitas di atas mereka.",
    password: "password-rahasia-tim"
};

// --- OBJEK KONFIGURASI UTAMA YANG AKAN DIEKSPOR ---

export const appConfig: Partial<CerebrumConfig> = {
    apiKeys: myApiKeys,
    providerStrategy: ['groq', 'openai', 'gemini', 'mistral', 'anthropic', 'perplexity'],
    modelDefaults: { 
        groq: 'llama3-70b-8192',
        openai: 'gpt-4o',
        gemini: 'gemini-1.5-pro-latest',
        perplexity: 'llama-3-sonar-large-32k-online',
        mistral: 'mistral-large-latest',
        anthropic: 'claude-3-opus-20240229',
    },
    // Daftarkan provider kustom di sini
    customProviders: {
        mistral: mistralProviderConfig,
        anthropic: anthropicProviderConfig,
    },
    tools: myTools,
    caching: { enabled: true, ttl: 60 },
    contextManagement: { strategy: 'slidingWindow' as const, maxMessages: 10 },
    prompting: {
        systemPrompt: "Selalu jawab dalam Bahasa Indonesia yang sopan dan profesional."
    },
};

// Ekspor implementasi agar bisa diimpor oleh file utama
export { myToolImplementations };
