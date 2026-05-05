/**
 * Minimal Agent stub matching what swarm.mjs `runAgent` expects.
 */

export function createStubAgentFactory({ status = "finished", summary = "ok", throwOnCreate = null } = {}) {
  return async () => {
    if (throwOnCreate) throw throwOnCreate;
    return {
      send: async () => ({
        async * stream() {},
        wait: async () => ({
          id: "run-mock",
          status,
          result: summary,
          durationMs: 1,
        }),
      }),
      async [Symbol.asyncDispose]() {},
    };
  };
}
