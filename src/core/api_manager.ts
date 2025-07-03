/**
 * @file src/core/api_manager.ts
 * @description Mengelola logika state kunci API, seperti status dan prioritas fallback.
 */
import { createLogger } from './logger.js';
import { ApiState, ApiStatePersistenceAdapter, ApiKeyInfo } from '../adapters/BaseAdapter.js';
import { CerebrumConfig } from '../config/schema.js';

const log = createLogger('APIManager');

class ApiManager {
  private adapter!: ApiStatePersistenceAdapter;
  private config!: CerebrumConfig;
  private state!: ApiState;
  private isInit = false; // Nama properti internal

  /**
   * Memeriksa apakah ApiManager sudah diinisialisasi.
   * Digunakan oleh HealthMonitor untuk memastikan tidak berjalan terlalu cepat.
   */
  public isInitialized(): boolean {
    return this.isInit;
  }
  
  async initialize(adapter: ApiStatePersistenceAdapter, config: CerebrumConfig): Promise<void> {
    if (this.isInit) return;
    this.adapter = adapter;
    this.config = config;
    this.state = await this.adapter.readState(this.config);
    this.isInit = true; // Set properti internal
    log.info('API Manager diinisialisasi dengan state yang dimuat dari adapter.');
    await this.performDailyResetCheck();
  }

  private ensureInitialized(): void {
    if (!this.isInit) {
      throw new Error('APIManager belum diinisialisasi. Panggil .initialize() terlebih dahulu.');
    }
  }
  
  private async performDailyResetCheck(): Promise<void> {
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - (this.state.lastDailyReset || 0) > oneDay) {
        log.warn('Reset harian terdeteksi. Membuat state baru...');
        this.state = await this.adapter.readState(this.config);
        this.state.lastDailyReset = Date.now();
        await this.adapter.writeState(this.state);
    }
  }

  public getState(): ApiState {
    this.ensureInitialized();
    return this.state;
  }
  
  private async saveState(): Promise<void> {
      this.ensureInitialized();
      await this.adapter.writeState(this.state);
  }

  public getNextAvailableKey(provider: string, excludedKeys: Set<string>): string | null {
    this.ensureInitialized();
    const providerKeys = this.state.providers[provider] || [];
    const availableKey = providerKeys.find(k => k.status === 'active' && !excludedKeys.has(k.key));
    return availableKey ? availableKey.key : null;
  }

  public async updateKeyStatus(keyToUpdate: string, newStatus: ApiKeyInfo['status']): Promise<void> {
    this.ensureInitialized();
    for (const provider in this.state.providers) {
      const keyInfo = this.state.providers[provider].find(k => k.key === keyToUpdate);
      if (keyInfo) {
        log.warn(`Mengubah status kunci ...${keyToUpdate.slice(-4)} menjadi '${newStatus}'`);
        keyInfo.status = newStatus;
        keyInfo.lastUsed = Date.now();
        keyInfo.failureCount = (keyInfo.failureCount || 0) + 1;
        keyInfo.cooldownUntil = newStatus === 'rate_limited' ? Date.now() + 5 * 60 * 1000 : null;
        await this.saveState();
        return;
      }
    }
  }

  public async demoteProvider(providerName: string): Promise<void> {
    this.ensureInitialized();
    const priority = this.state.providerPriority;
    const index = priority.indexOf(providerName);
    if (index > -1 && index < priority.length - 1) {
      log.warn(`Menurunkan prioritas provider: ${providerName}.`);
      const [demoted] = priority.splice(index, 1);
      priority.push(demoted);
      await this.saveState();
    }
  }

  public async setHighestPriority(providerName: string): Promise<void> {
    this.ensureInitialized();
    const priority = this.state.providerPriority;
    const index = priority.indexOf(providerName);

    if (index > 0) {
      log.info(`Promosi persisten: ${providerName.toUpperCase()} menjadi prioritas utama.`);
      const [provider] = priority.splice(index, 1);
      priority.unshift(provider);
      await this.saveState();
    }
  }
}

export default new ApiManager();