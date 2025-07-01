/**
 * @file src/config/errors.ts
 * @description Mendefinisikan kelas-kelas error kustom untuk framework Cerebrum.
 */
export class CerebrumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ConfigError extends CerebrumError {}
export class AdapterError extends CerebrumError {}
export class InvalidApiKeyError extends CerebrumError {}
export class InsufficientQuotaError extends CerebrumError {}
export class RateLimitError extends CerebrumError {}
export class ServiceUnavailableError extends CerebrumError {}
export class AllProvidersFailedError extends CerebrumError {
  public readonly lastError?: Error;
  constructor(message: string, lastError?: Error) {
    super(message);
    this.lastError = lastError;
  }
}
export class ContentExtractionError extends CerebrumError {}