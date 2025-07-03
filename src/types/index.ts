/**
 * @file src/types/index.ts
 * @description Mendefinisikan tipe dan interface global untuk framework.
 */
import { CerebrumConfig } from '../config/schema.js';
import { Message } from '../adapters/BaseAdapter.js';

export interface CorePromptConfig {
  content: string;
  password?: string;
}

export interface ChatOptions {
  systemPrompt?: string;
  // OPSI BARU: Kontrol penggunaan tool oleh AI
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface HookContext {
  sessionId: string;
  config: Readonly<CerebrumConfig>;
  history?: Message[];
  userInput?: string;
  response?: any;
  error?: Error;
}

export interface Plugin {
  name: string;
  onBootstrap?: (context: Pick<HookContext, 'config' | 'sessionId'>) => Promise<void> | void;
  onPreChat?: (context: Pick<HookContext, 'sessionId' | 'config' | 'userInput'>) => Promise<void> | void;
  onPreRequest?: (context: { history: Message[] } & HookContext) => Promise<void> | void;
  onToolCall?: (context: { toolCalls: any[] } & HookContext) => Promise<void> | void;
  onToolResult?: (context: { toolResults: any[] } & HookContext) => Promise<void> | void;
  onResponseChunk?: (context: { chunk: string } & HookContext) => Promise<void> | void;
  onChatComplete?: (context: HookContext) => Promise<void> | void;
}

export type ToolImplementation = (args: any) => Promise<any> | any;