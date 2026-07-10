import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { QueryClient } from '@tanstack/react-query'
import { prefetchUserPreferences } from '../user-preferences-query'
import { logger } from '~/shared/utils/logger'

vi.mock('~/shared/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('prefetchUserPreferences', () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockReset()
  })

  it('logs query failures before falling back to undefined', async () => {
    const error = new Error('preferences unavailable')
    const queryClient = {
      ensureQueryData: vi.fn().mockRejectedValue(error),
    } as unknown as QueryClient

    await expect(prefetchUserPreferences(queryClient)).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(
      '[preferences] Failed to prefetch user preferences',
      error,
    )
  })
})
