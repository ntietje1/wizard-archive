const DEFAULT_MICROTASK_FLUSH_COUNT = 5

export async function flushMicrotasks(count = DEFAULT_MICROTASK_FLUSH_COUNT) {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve()
  }
}

/**
 * Runs an assertion that should throw on failure, retrying caught intermediate failures across
 * `count` microtask yields. The default count is `DEFAULT_MICROTASK_FLUSH_COUNT`; after those
 * retries, `waitForMicrotasks` invokes the assertion once more without catching errors.
 */
export async function waitForMicrotasks(
  assertion: () => void,
  count = DEFAULT_MICROTASK_FLUSH_COUNT,
) {
  for (let i = 0; i < count; i += 1) {
    try {
      assertion()
      return
    } catch {
      await Promise.resolve()
    }
  }
  assertion()
}
