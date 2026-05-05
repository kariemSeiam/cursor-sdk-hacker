import { describe, test, mock } from "node:test";
import assert from "node:assert";

import {
  withRetry,
  batchWithStagger,
  isRetryableError,
  isIPRateLimit,
} from "../src/lib/rate-limiter.mjs";
import { RateLimitError, NetworkError, CursorSdkError } from "@cursor/sdk";

describe("rate-limiter", () => {
  test("withRetry returns first successful invocation", async () => {
    const value = await withRetry(async () => 42, {
      retries: 2,
      baseDelay: 1,
      onRetry: () => assert.fail("should not retry"),
    });
    assert.strictEqual(value, 42);
  });

  test("withRetry exhausts retries and rethrows terminal errors", async () => {
    const err = new Error("boom");
    await assert.rejects(
      async () =>
        withRetry(async () => {
          throw err;
        }, { retries: 2, baseDelay: 1 }),
      /boom/
    );
  });

  test("withRetry stops immediately for authentication-style failures", async () => {
    let attempts = 0;
    const err = new CursorSdkError("no access", { isRetryable: false, status: 401 });

    await assert.rejects(
      async () =>
        withRetry(async () => {
          attempts++;
          throw err;
        }, { retries: 5, baseDelay: 1 }),
      CursorSdkError
    );
    assert.strictEqual(attempts, 1);
  });

  test("withRetry backs off between retryable failures without multi-second sleeps", async () => {
    const mr = mock.method(Math, "random", () => 0);

    const origSetTimeout = global.setTimeout;
    // `withRetry` uses exponential delays derived from BASE_DELAY (~1s). Collapse sleeps for CI speed.
    // eslint-disable-next-line no-global-assign
    global.setTimeout = (fn, _delay, ...extra) => origSetTimeout(fn, 0, ...extra);

    /** @type {unknown[]} */
    const retryArgs = [];
    let calls = 0;
    async function flaky() {
      calls++;
      if (calls < 2) throw new RateLimitError("wait", { status: 429 });
      return "ok";
    }

    try {
      const result = await withRetry(flaky, {
        retries: 3,
        baseDelay: 5,
        onRetry: info => retryArgs.push(info),
      });

      assert.strictEqual(result, "ok");
      assert.strictEqual(calls, 2);
      assert.strictEqual(retryArgs.length, 1);
      assert.strictEqual(typeof retryArgs[0].delay, "number");
    } finally {
      global.setTimeout = origSetTimeout;
      mr.mock.restore();
    }
  });

  test("isRetryableError recognizes SDK primitives and HTTP hints", () => {
    assert.strictEqual(isRetryableError(new RateLimitError("r", {})), true);
    assert.strictEqual(isRetryableError(new NetworkError("n", {})), true);
    assert.strictEqual(isRetryableError(new CursorSdkError("retry", { isRetryable: true })), true);
    assert.strictEqual(isRetryableError(Object.assign(new Error("too many requests"), {})), true);
    assert.strictEqual(isRetryableError(Object.assign(new Error(""), { status: 503 })), true);
    assert.strictEqual(isRetryableError(Object.assign(new Error(""), { statusCode: 502 })), true);
    assert.strictEqual(isRetryableError(new Error("fatal")), false);
  });

  test("isIPRateLimit distinguishes 464 and message cues", () => {
    assert.strictEqual(isIPRateLimit(new RateLimitError("up", { status: 464 })), true);
    assert.strictEqual(isIPRateLimit(new Error("Error 464 from edge")), true);
    assert.strictEqual(isIPRateLimit(new RateLimitError("light", { status: 429 })), false);
  });

  test("batchWithStagger maps fulfilled values and settles rejections into error objects", async () => {
    const out = await batchWithStagger(
      [10, 20, 30],
      async item => ({ item, doubled: item * 2 }),
      { concurrency: 10, staggerMs: 0 }
    );
    assert.deepStrictEqual(out, [
      { item: 10, doubled: 20 },
      { item: 20, doubled: 40 },
      { item: 30, doubled: 60 },
    ]);

    const bad = await batchWithStagger(
      ["x"],
      async () => { throw new Error("nope"); },
      { concurrency: 1, staggerMs: 0 }
    );

    assert.strictEqual(bad[0].success, false);
    assert.strictEqual(bad[0].error, "nope");
  });

  test("batchWithStagger processes items in deterministic order with zero stagger", async () => {
    const order = [];
    const outs = await batchWithStagger(
      ["a", "b", "c", "d"],
      async (item, idx) => {
        order.push({ item, idx });
        return item;
      },
      { concurrency: 2, staggerMs: 0 }
    );
    assert.deepStrictEqual(outs, ["a", "b", "c", "d"]);
    assert.strictEqual(order.length, 4);
  });
});
