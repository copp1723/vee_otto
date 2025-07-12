/**
 * Unified Retry Utilities
 * Consolidates retry logic from across the codebase
 */

import pRetry from 'p-retry';
import { Logger } from './Logger';

export interface RetryOptions {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  factor?: number;
  onFailedAttempt?: (error: Error, attempt: number) => void;
}

const logger = new Logger('RetryUtils');

/**
 * Unified retry function that wraps p-retry with our standard configuration
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const defaultOptions: RetryOptions = {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 10000,
    factor: 2,
  };

  const finalOptions = { ...defaultOptions, ...options };

  return await pRetry(operation, {
    retries: finalOptions.retries!,
    minTimeout: finalOptions.minTimeout!,
    maxTimeout: finalOptions.maxTimeout!,
    factor: finalOptions.factor!,
    onFailedAttempt: (error) => {
      const attempt = (error as any).attemptNumber;
      logger.warn(`Retry attempt ${attempt} failed: ${error.message}`);
      
      if (finalOptions.onFailedAttempt) {
        finalOptions.onFailedAttempt(error, attempt);
      }
    },
  });
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        logger.debug(`Retrying after ${delay}ms (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Retry with custom condition
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options: { maxAttempts?: number; delay?: number } = {}
): Promise<T> {
  const { maxAttempts = 10, delay = 1000 } = options;
  
  for (let i = 0; i < maxAttempts; i++) {
    const result = await fn();
    if (condition(result)) {
      return result;
    }
    if (i < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Condition not met after ${maxAttempts} attempts`);
}
