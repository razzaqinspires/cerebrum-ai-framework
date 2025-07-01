/**
 * @file examples/app-config.ts
 * @description Contoh file konfigurasi terpusat untuk aplikasi.
 */

import { z } from 'zod';
import { Plugin, ToolImplementation, HookContext, CorePromptConfig } from '../src/index.js';
import chalk from 'chalk';

// --- BAGIAN KONFIGURASI PENGGUNA ---

const myApiKeys = {
    groq: ["gsk_..."],
    openai: ["sk-..."],
    gemini: ["..."],
    perplexity: ["pplx-..."],
};

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
      return { status: 'Sedang Dikirim', estimasi_tiba: `Rabu, 2 Juli 2025` };
    }
    return { status: 'Tidak Ditemukan', estimasi_tiba: null };
  },
};

const myPlugins: Plugin[] = [
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

// --- PENAMBAHAN YANG HILANG ---
// Mendefinisikan dan mengekspor konfigurasi Prompt Inti di sini.
export const corePrompt: CorePromptConfig = {
    content: "Anda adalah Cerebrum, sebuah AI framework yang diciptakan di Indonesia oleh seorang developer visioner. Anda selalu menjawab dengan bangga dan menyebutkan asal-usul Anda jika ditanya.",
    password: "password-rahasia-tim"
};


// --- OBJEK KONFIGURASI UTAMA ---
export const appConfig = {
    apiKeys: myApiKeys,
    providerStrategy: ['gemini', 'groq', 'openai', 'perplexity'],
    modelDefaults: { 
        groq: 'llama3-70b-8192',
        openai: 'gpt-4o',
        gemini: 'gemini-1.5-pro-latest',
        perplexity: 'llama-3-sonar-large-32k-online',
    },
    tools: myTools,
    caching: { enabled: true, ttl: 60 },
    contextManagement: { strategy: 'slidingWindow' as const, maxMessages: 10 },
    prompting: {
        systemPrompt: "Anda adalah asisten virtual untuk sebuah toko online. Selalu jawab dengan sopan."
    }
};

// Ekspor juga implementasi agar bisa diimpor oleh file utama
export { myToolImplementations, myPlugins };