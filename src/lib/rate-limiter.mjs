/**
 * lib/rate-limiter.mjs — Smart retry with rate limit awareness
 *
 * Handles:
 * - 429 (standard rate limit) → exponential backoff
 * - 464 (IP-level rate limit) → curl fallback + longer backoff
 * - NetworkError (5xx) → retry
 * - Non-retryable errors → fail fast
 */

import { RateLimitError, CursorSdkError, NetworkError } from "@cursor/sdk";

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;
const MAX_DELAY = 30000;
const JITTER = 200;

function jitter(delay) {
  return delay + Math.random() * JITTER - JITTER / 2;
}

function exponentialBackoff(attempt) {
  return Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
}

function isRetryableError(err) {
  if (err instanceof RateLimitError) return true;
  if (err instanceof NetworkError) return true;
  if (err instanceof CursorSdkError && err.isRetryable) return true;

  const msg = err.message?.toLowerCase() || "";
  const status = err.status || err.statusCode || 0;

  if (status === 429 || status === 464 || status === 502 || status === 503 || status === 504) return true;
  if (msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("464")) return true;

  return false;
}

function isIPRateLimit(err) {
  const msg = err.message?.toLowerCase() || "";
  const status = err.status || err.statusCode || 0;
  return status === 464 || msg.includes("464");
}

export async function withRetry(fn, options = {}) {
  const {
    retries = MAX_RETRIES,
    baseDelay = BASE_DELAY,
    onRetry,
    label = "operation",
  } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries || !isRetryableError(err)) {
        throw err;
      }

      const delay = isIPRateLimit(err)
        ? exponentialBackoff(attempt) * 2
        : exponentialBackoff(attempt);

      const jittered = jitter(delay);

      if (onRetry) {
        onRetry({ attempt: attempt + 1, error: err, delay: jittered, isIPLimit: isIPRateLimit(err) });
      }

      await new Promise(r => setTimeout(r, jittered));
    }
  }
}

export async function batchWithStagger(items, fn, { concurrency = 3, staggerMs = 2000 } = {}) {
  const results = [];

  for (let batchStart = 0; batchStart < items.length; batchStart += concurrency) {
    const batch = items.slice(batchStart, batchStart + concurrency);

    if (batchStart > 0) {
      await new Promise(r => setTimeout(r, staggerMs));
    }

    const batchResults = await Promise.allSettled(
      batch.map((item, i) => fn(item, batchStart + i))
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value);
      else results.push({ error: r.reason?.message || "Unknown", success: false });
    }
  }

  return results;
}

export { isRetryableError, isIPRateLimit };
