/**
 * @file src/core/health_monitor.ts
 * @description Layanan latar belakang yang secara proaktif memeriksa kesehatan provider
 * dan mengaktifkan kembali kunci yang telah pulih.
 */
import apiManager from './api_manager.js';
import { createLogger, Logger } from './logger.js';
import llmService from '../services/llm_service.js';
import { CerebrumConfig } from '../config/schema.js';

const log: Logger = createLogger('HealthMonitor');
let monitorInterval: NodeJS.Timeout | null = null;
let appConfig: CerebrumConfig | null = null;

/**
 * Fungsi utama yang berjalan periodik untuk memeriksa kesehatan sistem.
 */
async function runHealthChecks() {
  if (!apiManager.isInitialized()) {
    log.debug('APIManager belum siap, melewati health check.');
    return;
  }
  
  log.info('Menjalankan pemeriksaan kesehatan provider...');
  const state = apiManager.getState();
  const idealProviderOrder = appConfig?.providerStrategy || [];

  // 1. Pulihkan kunci yang cooldown-nya sudah berakhir
  for (const providerName in state.providers) {
    for (const keyInfo of state.providers[providerName]) {
      if (keyInfo.status === 'rate_limited' && keyInfo.cooldownUntil && Date.now() > keyInfo.cooldownUntil) {
        log.info(`Kunci ...${keyInfo.key.slice(-4)} (${providerName}) pulih dari rate limit. Mengaktifkan kembali.`);
        await apiManager.updateKeyStatus(keyInfo.key, 'active');
      }
    }
  }

  // 2. Coba "ping" provider prioritas tinggi yang sedang tidak aktif untuk melihat apakah sudah pulih
  const currentTopProvider = state.providerPriority[0];
  for (const providerNameToTest of idealProviderOrder) {
    // Jika provider ideal ini sudah menjadi prioritas utama, tidak perlu dicek.
    if (providerNameToTest === currentTopProvider) {
      break; 
    }

    const keysToTest = state.providers[providerNameToTest] || [];
    const unhealthyOrDemotedKey = keysToTest.find(k => k.status !== 'active');

    if (unhealthyOrDemotedKey) {
        log.debug(`Mencoba ping ke provider '${providerNameToTest}' yang sedang tidak sehat/terdemotivasi...`);
        const isHealthy = await llmService.healthCheck(providerNameToTest, unhealthyOrDemotedKey.key);
        
        if (isHealthy) {
            log.info(`Provider ${providerNameToTest.toUpperCase()} terdeteksi pulih! Mengaktifkan kembali semua kuncinya dan mempromosikannya.`);
            // Aktifkan kembali semua kunci untuk provider ini
            for (const key of keysToTest) {
                if(key.status !== 'active') await apiManager.updateKeyStatus(key.key, 'active');
            }
            // Jadikan provider ini prioritas utama
            await apiManager.setHighestPriority(providerNameToTest);
            // Hentikan pengecekan di siklus ini setelah menemukan satu yang pulih
            return; 
        }
    }
  }
}

/**
 * Memulai layanan Health Monitor.
 * @param manager Instance dari ApiManager.
 * @param config Konfigurasi utama Cerebrum.
 */
function start(manager: typeof apiManager, config: CerebrumConfig) {
  if (monitorInterval) {
    log.warn('Health monitor sudah berjalan.');
    return;
  }
  appConfig = config;
  // Jalankan pemeriksaan setiap 5 menit (300000 ms).
  log.info('Health Monitor diaktifkan. Akan memeriksa status provider setiap 5 menit.');
  monitorInterval = setInterval(() => runHealthChecks(), 300000);
}

/**
 * Menghentikan layanan Health Monitor.
 */
function stop() {
  if (monitorInterval) {
    log.info('Health Monitor dinonaktifkan.');
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

export default { start, stop };