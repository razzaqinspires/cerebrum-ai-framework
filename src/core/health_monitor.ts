import apiManager from './api_manager.js';
import { createLogger } from './logger.js';

const log = createLogger('HealthMonitor');
let monitorInterval: NodeJS.Timeout | null = null;

async function checkAndReactivateKeys() {
  try {
    const state = apiManager.getState();
    let promotedProvider: string | null = null;

    for (const providerName in state.providers) {
      const keys = state.providers[providerName];
      let hasActiveKeyNow = false;

      for (const keyInfo of keys) {
        if (keyInfo.status === 'rate_limited' && keyInfo.cooldownUntil && Date.now() > keyInfo.cooldownUntil) {
          log.info(`Kunci ...${keyInfo.key.slice(-4)} (${providerName}) telah pulih. Mengaktifkan kembali.`); // Diganti dari .success()
          await apiManager.updateKeyStatus(keyInfo.key, 'active');
        }
        if (keyInfo.status === 'active') {
          hasActiveKeyNow = true;
        }
      }

      if (hasActiveKeyNow && state.providerPriority.indexOf(providerName) > 0 && promotedProvider !== providerName) {
        await apiManager.promoteProvider(providerName);
        promotedProvider = providerName;
      }
    }
  } catch(e) {
      log.error("Health monitor gagal berjalan, mungkin APIManager belum siap.", e)
  }
}

function start(manager: typeof apiManager) {
  if (monitorInterval) {
    log.warn('Health monitor sudah berjalan.');
    return;
  }
  log.info('Health Monitor diaktifkan. Memeriksa status kunci setiap 60 detik.');
  monitorInterval = setInterval(() => checkAndReactivateKeys(), 60000);
}

function stop() {
  if (monitorInterval) {
    log.info('Health Monitor dinonaktifkan.');
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

export default { start, stop };