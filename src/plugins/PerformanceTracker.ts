/**
 * @file src/plugins/PerformanceTracker.ts
 * @description Plugin untuk melacak dan mencatat metrik performa setiap panggilan AI.
 */
import { Plugin, HookContext } from '../types/index.js';
import { MetricsAdapter, PerformanceRecord } from '../adapters/BaseAdapter.js';
import { FileMetricsAdapter } from '../adapters/FileMetricsAdapter.js';
import { countTokens } from '../core/tokenizer.js';
import { AllProvidersFailedError } from '../config/errors.js';

interface RequestState {
  startTime: number;
  provider?: string;
  model?: string;
  promptTokens?: number;
}

export class PerformanceTrackerPlugin implements Plugin {
  public readonly name = 'PerformanceTracker';
  private metricsAdapter: MetricsAdapter;
  private requestMap = new Map<string, RequestState>();

  constructor(adapter?: MetricsAdapter) {
    this.metricsAdapter = adapter || new FileMetricsAdapter();
  }

  // Sebelum permintaan dikirim ke responder
  async onPreRequest(context: HookContext & { history: Message[] }): Promise<void> {
    const state: RequestState = {
        startTime: Date.now(),
        promptTokens: countTokens(JSON.stringify(context.history)),
    };
    // Kita gunakan kombinasi sessionId dan timestamp sebagai ID permintaan unik
    this.requestMap.set(context.sessionId, state);
  }

  // Setelah seluruh proses chat selesai (sukses atau gagal)
  async onChatComplete(context: HookContext): Promise<void> {
    const state = this.requestMap.get(context.sessionId);
    if (!state) return;

    const latencyMs = Date.now() - state.startTime;
    const response = context.response;
    const error = context.error;
    
    // Dapatkan provider yang berhasil dari respons, atau dari error
    let finalProvider = 'N/A';
    if (response?.provider) {
        finalProvider = response.provider;
    } else if (error instanceof AllProvidersFailedError && error.lastError) {
        // Coba ekstrak dari error terakhir jika memungkinkan
        const match = error.lastError.message.match(/provider (\w+)/i);
        if (match) finalProvider = match[1];
    }
    
    const record: PerformanceRecord = {
      timestamp: new Date().toISOString(),
      sessionId: context.sessionId,
      provider: finalProvider,
      model: context.config.modelDefaults[finalProvider] || 'N/A',
      latencyMs: latencyMs,
      promptTokens: state.promptTokens || 0,
      completionTokens: context.response?.content ? countTokens(context.response.content) : 0,
      success: !error,
      errorType: error ? error.constructor.name : undefined,
    };

    await this.metricsAdapter.log(record);
    this.requestMap.delete(context.sessionId); // Hapus state setelah dicatat
  }
}