/**
 * @file src/config/schema.ts
 * @description Mendefinisikan skema validasi (Zod) untuk seluruh objek konfigurasi Cerebrum.
 * Ini adalah satu-satunya sumber kebenaran untuk bentuk data konfigurasi.
 */

import { z } from 'zod';
import { Message } from '../adapters/BaseAdapter.js';

/**
 * Skema untuk mendefinisikan konfigurasi sebuah provider, baik bawaan maupun kustom.
 */
export const providerConfigSchema = z.object({
  /** Fungsi untuk mendapatkan URL endpoint API. Menerima nama model sebagai argumen. */
  getEndpoint: z.function().args(z.string()).returns(z.string()),
  /** Fungsi untuk membangun payload/body permintaan API. */
  buildPayload: z.function().args(z.any(), z.string(), z.any().optional()).returns(z.object({})),
  /** Fungsi untuk mengekstrak objek Message dari respons API. */
  extractMessage: z.function().args(z.any()).returns(z.any().nullable()),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

/**
 * Skema untuk mendefinisikan sebuah tool yang bisa digunakan oleh AI.
 */
export const toolSchema = z.object({
  /** Nama fungsi yang unik. AI akan memanggil nama ini. */
  name: z.string().min(1),
  /** Deskripsi yang jelas agar AI tahu kapan harus menggunakan tool ini. */
  description: z.string().min(1),
  /** Skema Zod yang mendefinisikan parameter yang dibutuhkan oleh fungsi tool. */
  parameters: z.any().refine(val => val instanceof z.ZodObject, {
    message: "Parameters harus merupakan instance dari Zod.object",
  }),
});
export type ToolDefinition = z.infer<typeof toolSchema>;

/**
 * Skema untuk konfigurasi manajemen konteks.
 */
const contextManagementSchema = z.union([
  z.object({
    strategy: z.literal('slidingWindow'),
    maxMessages: z.number().int().positive(),
  }),
  z.object({
    strategy: z.literal('tokenLimit'),
    maxTokens: z.number().int().positive(),
  }),
]).optional();

/**
 * Skema utama dan terlengkap untuk objek konfigurasi Cerebrum.
 */
export const configSchema = z.object({
  /** Objek berisi kunci API. Key adalah nama provider, value adalah array of strings. */
  apiKeys: z.record(z.string(), z.array(z.string()).min(1)),
  
  /** Array yang menentukan urutan prioritas provider fallback. */
  providerStrategy: z.array(z.string()).min(1),
  
  /** Memetakan provider ke nama model default yang akan digunakan. */
  modelDefaults: z.record(z.string(), z.string()),
  
  /** Konfigurasi untuk provider kustom yang tidak ada secara bawaan. */
  customProviders: z.record(z.string(), providerConfigSchema).optional(),

  /** Pengaturan prompt default. */
  prompting: z.object({
    systemPrompt: z.string().optional(),
  }).optional(),
  
  /** Pengaturan manajemen konteks otomatis. */
  contextManagement: contextManagementSchema,
  
  /** Array berisi definisi semua tool yang tersedia. */
  tools: z.array(toolSchema).optional(),
  
  /** Pengaturan untuk caching respons. */
  caching: z.object({
    enabled: z.boolean().default(false),
    ttl: z.number().int().positive().describe('Masa berlaku cache dalam detik.'),
  }).optional(),

}).refine(data => {
    // Validasi silang: memastikan setiap provider dalam strategi punya kunci ATAU definisi kustom.
    for (const provider of data.providerStrategy) {
        const hasApiKey = data.apiKeys[provider] && data.apiKeys[provider].length > 0;
        const hasCustomProvider = data.customProviders?.[provider];
        if (!hasApiKey && !hasCustomProvider) {
            return false;
        }
    }
    return true;
}, {
    message: "Setiap provider dalam 'providerStrategy' harus memiliki setidaknya satu kunci API di 'apiKeys' ATAU sebuah definisi di 'customProviders'",
    path: ["providerStrategy"],
});

/**
 * Tipe data TypeScript yang dihasilkan secara otomatis dari skema Zod di atas.
 * Digunakan di seluruh framework untuk type safety.
 */
export type CerebrumConfig = z.infer<typeof configSchema>;