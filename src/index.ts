/**
 * @file src/index.ts
 * @description Titik masuk utama untuk paket NPM.
 * Mengekspor semua kelas, tipe, dan error yang relevan bagi pengguna.
 */

export { Cerebrum, type ChatStreamEvent } from './Cerebrum.js';

export * from './config/errors.js';

export type {
  ApiStatePersistenceAdapter,
  CacheAdapter,
  MemoryAdapter,
  Message,
  PerformanceRecord,
} from './adapters/BaseAdapter.js';

export type { 
    Plugin, 
    HookContext, 
    ToolImplementation,
    CorePromptConfig,
    ChatOptions // <-- DITAMBAHKAN DI SINI
} from './types/index.js';

export type { CerebrumConfig, ToolDefinition, ProviderConfig } from './config/schema.js';