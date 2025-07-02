/**
 * @file src/Cerebrum.ts
 * @description Kelas utama dari Framework Cerebrum.
 */

// Impor dari Node.js
import { createHash } from 'crypto';

// Impor dari library eksternal
import { createLogger, Logger } from './core/logger.js';

// Impor dari internal framework
import { configSchema, type CerebrumConfig, type ProviderConfig } from './config/schema.js';
import { ConfigError, AllProvidersFailedError, CerebrumError } from './config/errors.js';
import ApiStateAdapter from './adapters/ApiStateAdapter.js';
import FileMemoryAdapter from './adapters/FileMemoryAdapter.js';
import { InMemoryCacheAdapter } from './adapters/InMemoryCacheAdapter.js';
import apiManager from './core/api_manager.js';
import healthMonitor from './core/health_monitor.js';
import responder from './services/responder.js';
import { MemoryAdapter, ApiStatePersistenceAdapter, CacheAdapter, Message } from './adapters/BaseAdapter.js';
import { Plugin, HookContext, ToolImplementation, CorePromptConfig, ChatOptions } from './types/index.js';
import { countTokens } from './core/tokenizer.js';
import { builtInProviderConfigs } from './services/llm_service.js';

// Tipe data untuk event yang dihasilkan oleh stream
export interface ChatStreamEvent {
  type: 'chunk' | 'tool_call' | 'tool_result' | 'cached_response' | 'error';
  provider?: string;
  content: any;
}

/**
 * Kelas utama dari Framework Cerebrum.
 * Ini adalah titik masuk utama untuk berinteraksi dengan semua fitur AI.
 */
export class Cerebrum {
  public readonly config: CerebrumConfig;
  private readonly allProviderConfigs: Record<string, ProviderConfig>;
  private readonly memoryAdapter: MemoryAdapter;
  private readonly apiStateAdapter: ApiStatePersistenceAdapter;
  private readonly cacheAdapter: CacheAdapter | null = null;
  private readonly toolImplementations: Record<string, ToolImplementation>;
  private readonly plugins: Plugin[];
  private readonly log: Logger;
  private corePrompt: string;
  private corePromptPassword?: string;

  constructor(
    config: Partial<CerebrumConfig>,
    toolImplementations: Record<string, ToolImplementation> = {},
    plugins: Plugin[] = [],
    corePromptConfig?: CorePromptConfig
  ) {
    this.log = createLogger('Cerebrum');

    const validationResult = configSchema.safeParse(config);
    if (!validationResult.success) {
      const errorDetails = JSON.stringify(validationResult.error.flatten().fieldErrors, null, 2);
      this.log.error(`Konfigurasi tidak valid. Error: ${errorDetails}`);
      throw new ConfigError(`Konfigurasi tidak valid: ${errorDetails}`);
    }
    this.config = validationResult.data;

    this.allProviderConfigs = { ...builtInProviderConfigs, ...this.config.customProviders };

    for (const p of this.config.providerStrategy) {
      if (!this.allProviderConfigs[p]) {
        throw new ConfigError(`Provider '${p}' di providerStrategy tidak punya definisi di provider bawaan maupun kustom.`);
      }
    }

    // @ts-ignore
    this.memoryAdapter = config.adapters?.memory || new FileMemoryAdapter();
    // @ts-ignore
    this.apiStateAdapter = config.adapters?.apiState || new ApiStateAdapter();

    if (this.config.caching?.enabled) {
      // @ts-ignore
      this.cacheAdapter = config.adapters?.cache || new InMemoryCacheAdapter();
      this.log.info(`Caching diaktifkan dengan TTL ${this.config.caching.ttl} detik.`);
    }

    if (this.config.tools) {
      for (const toolDef of this.config.tools) {
        if (!toolImplementations[toolDef.name]) {
          throw new ConfigError(`Tool '${toolDef.name}' didefinisikan tapi tidak memiliki implementasi.`);
        }
      }
    }
    this.toolImplementations = toolImplementations;
    this.plugins = plugins;

    this.corePrompt = corePromptConfig?.content || 'You are a helpful AI assistant named Cerebrum.';
    this.corePromptPassword = corePromptConfig?.password;
    
    this.log.info('Cerebrum diinisialisasi dengan konfigurasi yang valid.');
    if (this.plugins.length > 0) {
      this.log.info(`Plugin aktif: [${this.plugins.map(p => p.name).join(', ')}]`);
    }
  }

  public async bootstrap(): Promise<void> {
    this.log.info('Memulai proses bootstrap...');
    await apiManager.initialize(this.apiStateAdapter, this.config);
    healthMonitor.start(apiManager);
    await this._executePlugins('onBootstrap', { config: this.config, sessionId: 'system' });
    this.log.info('Sistem Cerebrum telah di-bootstrap dan siap digunakan.');
  }

  public shutdown(): void {
    this.log.info('Memulai proses shutdown...');
    healthMonitor.stop();
    this.log.info('Semua layanan latar belakang telah dihentikan.');
  }

  public updateCorePrompt(newPrompt: string, password?: string): boolean {
    if (this.corePromptPassword && password !== this.corePromptPassword) {
      this.log.warn('Gagal mengubah prompt inti: password salah.');
      return false;
    }
    this.corePrompt = newPrompt;
    this.log.info('Prompt Inti berhasil diperbarui.');
    return true;
  }

  public getMemoryAdapter(): MemoryAdapter {
    return this.memoryAdapter;
  }

  public async *chatStream(sessionId: string, userInput: string, options: ChatOptions = {}): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const baseContext: HookContext = { sessionId, config: this.config, userInput };
    await this._executePlugins('onPreChat', baseContext);

    try {
      const fullHistory = await this.memoryAdapter.getHistory(sessionId);
      
      const cachingConfig = this.config.caching;
      if (this.cacheAdapter && cachingConfig?.enabled) {
        const cacheKeyPayload = JSON.stringify([...this._pruneHistory(fullHistory), { role: 'user', content: userInput }]);
        const cacheKey = createHash('sha256').update(cacheKeyPayload).digest('hex');
        const cachedResponse = await this.cacheAdapter.get<string>(cacheKey);

        if (cachedResponse) {
          this.log.info(`CACHE HIT untuk sesi: ${sessionId}`);
          yield { type: 'cached_response', provider: 'cache', content: cachedResponse };
          await this._executePlugins('onChatComplete', { ...baseContext, response: cachedResponse });
          return;
        }
        this.log.info(`CACHE MISS untuk sesi: ${sessionId}`);
      }

      const userMessage: Message = { role: 'user', content: userInput };
      let currentHistory = [...fullHistory, userMessage];
      let fullResponse = '';
      const MAX_TOOL_CALLS = 5;
      let toolCallCount = 0;
      let finalProvider: string | undefined;

      while (toolCallCount++ < MAX_TOOL_CALLS) {
        const userSystemPrompt = options.systemPrompt || this.config.prompting?.systemPrompt || '';
        const finalSystemPrompt = `${this.corePrompt}\n\n${userSystemPrompt}`.trim();
        const prunedHistory = this._pruneHistory(currentHistory);
        const finalHistory: Message[] = [{ role: 'system', content: finalSystemPrompt }, ...prunedHistory];
        
        await this._executePlugins('onPreRequest', { ...baseContext, history: finalHistory });
        
        const { message, provider } = await responder.generateNextMessage(finalHistory, this.config, this.allProviderConfigs, this.config.tools);
        finalProvider = provider;

        if (message.tool_calls && message.tool_calls.length > 0) {
          const toolCalls = message.tool_calls;
          yield { type: 'tool_call', provider, content: toolCalls };
          await this._executePlugins('onToolCall', { ...baseContext, response: toolCalls });

          const toolResults = await responder.executeTools(toolCalls, this.toolImplementations);
          yield { type: 'tool_result', provider, content: toolResults };
          await this._executePlugins('onToolResult', { ...baseContext, response: toolResults });
          
          currentHistory.push(message, ...toolResults);
        } else {
          for await (const chunk of responder.streamFinalResponse(finalHistory, message, provider, this.config, this.allProviderConfigs)) {
             fullResponse += chunk;
             yield { type: 'chunk', provider, content: chunk };
             await this._executePlugins('onResponseChunk', { ...baseContext, response: { chunk } });
          }

          if (fullResponse.trim()) {
            await this.memoryAdapter.addMessage(sessionId, userMessage);
            await this.memoryAdapter.addMessage(sessionId, { role: 'assistant', content: fullResponse });
          }

          if (this.cacheAdapter && cachingConfig?.enabled) {
              const cacheKeyPayload = JSON.stringify([...prunedHistory, userMessage]);
              const cacheKey = createHash('sha256').update(cacheKeyPayload).digest('hex');
              await this.cacheAdapter.set(cacheKey, fullResponse, cachingConfig.ttl);
              this.log.info(`Respons baru disimpan ke cache.`);
          }
          break;
        }
      }

      if (toolCallCount > MAX_TOOL_CALLS) {
        throw new CerebrumError('Melebihi batas maksimal pemanggilan tool.');
      }

      await this._executePlugins('onChatComplete', { ...baseContext, response: fullResponse });

    } catch (error) {
      await this._executePlugins('onChatComplete', { ...baseContext, error: error as Error });
      if (error instanceof CerebrumError) throw error;
      throw new CerebrumError(`Error tak terduga saat streaming: ${(error as Error).message}`);
    }
  }

  private _pruneHistory(history: Message[]): Message[] {
    const contextConfig = this.config.contextManagement;
    if (!contextConfig) return history;

    this.log.debug(`Menerapkan strategi manajemen konteks: ${contextConfig.strategy}`);
    switch (contextConfig.strategy) {
      case 'slidingWindow': {
        const maxMessages = contextConfig.maxMessages;
        if (history.length > maxMessages) {
          const removedCount = history.length - maxMessages;
          this.log.info(`Konteks dipangkas: ${removedCount} pesan lama dihapus (batas: ${maxMessages} pesan).`);
          return history.slice(-maxMessages);
        }
        return history;
      }
      case 'tokenLimit': {
        const maxTokens = contextConfig.maxTokens;
        let currentTokens = 0;
        const prunedHistory: Message[] = [];
        for (let i = history.length - 1; i >= 0; i--) {
          const message = history[i];
          const tokens = countTokens(message.content);
          if (currentTokens + tokens <= maxTokens) {
            prunedHistory.unshift(message);
            currentTokens += tokens;
          } else {
            this.log.info(`Konteks dipangkas: Batas token ${maxTokens} tercapai.`);
            break;
          }
        }
        return prunedHistory;
      }
      default: return history;
    }
  }

  private async _executePlugins(hookName: keyof Plugin, context: HookContext): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = plugin[hookName];
      // @ts-ignore
      if (typeof hook === 'function') {
        try {
          // @ts-ignore
          await hook.call(plugin, context);
        } catch (error) {
          this.log.error(`Error pada plugin '${plugin.name}' saat hook '${hookName}':`, error);
        }
      }
    }
  }
}