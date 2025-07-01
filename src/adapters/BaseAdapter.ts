import { CerebrumConfig } from '../config/schema.js';

export interface ApiKeyInfo {
  key: string;
  status: 'active' | 'rate_limited' | 'quota_exhausted' | 'invalid';
  cooldownUntil: number | null;
  lastUsed: number | null;
  failureCount: number;
}

export interface ApiState {
  providers: Record<string, ApiKeyInfo[]>;
  providerPriority: string[];
  lastDailyReset: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
  name?: string;
}

export interface ApiStatePersistenceAdapter {
  readState(config: CerebrumConfig): Promise<ApiState>;
  writeState(state: ApiState): Promise<void>;
}

export interface MemoryAdapter {
  getHistory(sessionId: string): Promise<Message[]>;
  addMessage(sessionId: string, message: Message): Promise<void>;
  clearHistory(sessionId: string): Promise<boolean>;
}

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}