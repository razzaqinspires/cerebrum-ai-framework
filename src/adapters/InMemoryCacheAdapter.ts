import { CacheAdapter } from './BaseAdapter.js';

interface CacheEntry<T> {
  value: T;
  expireAt: number;
}

export class InMemoryCacheAdapter implements CacheAdapter {
  private cache = new Map<string, CacheEntry<any>>();
  private interval: NodeJS.Timeout;

  constructor() {
    this.interval = setInterval(() => this.cleanup(), 60 * 60 * 1000); // setiap jam
  }

  public stopCleanup(): void {
    clearInterval(this.interval);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expireAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expireAt });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expireAt) {
        this.cache.delete(key);
      }
    }
  }
}