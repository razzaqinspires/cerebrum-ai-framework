import fs from 'fs/promises';
import path from 'path';
import { ApiState, ApiStatePersistenceAdapter, ApiKeyInfo } from './BaseAdapter.js';
import { CerebrumConfig } from '../config/schema.js';
import { AdapterError } from '../config/errors.js';

export default class ApiStateAdapter implements ApiStatePersistenceAdapter {
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'data/api_state.json');
  }

  private createNewState(config: CerebrumConfig): ApiState {
    const providers: Record<string, ApiKeyInfo[]> = {};
    if (config.apiKeys) {
        for (const providerName in config.apiKeys) {
            providers[providerName] = config.apiKeys[providerName].map(key => ({
                key,
                status: 'active',
                cooldownUntil: null,
                lastUsed: null,
                failureCount: 0,
            }));
        }
    }
    return {
        providers,
        providerPriority: [...config.providerStrategy],
        lastDailyReset: Date.now(),
    };
  }

  async readState(config: CerebrumConfig): Promise<ApiState> {
    try {
      await fs.access(this.filePath);
      const rawData = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(rawData) as ApiState;
    } catch {
      return this.createNewState(config);
    }
  }

  async writeState(state: ApiState): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(state, null, 2));
    } catch (error) {
      throw new AdapterError(`Gagal menulis state ke file: ${this.filePath}`);
    }
  }
}