import { describe, expect, it, vi } from 'vite-plus/test'
import type { ConvexReactClient } from 'convex/react'
import { DEFAULT_WORKSPACE_PREFERENCES } from '@wizard-archive/editor/resources/workspace-preferences'
import { ERROR_CODE } from '../../../../../shared/errors/client'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { createLiveWorkspacePreferences } from '../live-workspace-preferences'

describe('live workspace preferences', () => {
  it('projects watch failures explicitly and recovers on a later authorized snapshot', () => {
    let update: () => void = () => undefined
    let result: unknown = {
      error: {
        data: {
          kind: 'client',
          code: ERROR_CODE.NOT_AUTHENTICATED,
          message: 'Not authenticated',
        },
      },
    }
    const unsubscribe = vi.fn()
    const convex = {
      mutation: vi.fn(),
      watchQuery: () => ({
        localQueryResult: () => {
          if (typeof result === 'object' && result !== null && 'error' in result) {
            throw result.error
          }
          return result
        },
        onUpdate: (listener: () => void) => {
          update = listener
          return unsubscribe
        },
      }),
    } as unknown as ConvexReactClient
    const preferences = createLiveWorkspacePreferences(
      testDomainId('campaign', 'preferences-watch'),
      convex,
    )

    expect(() => preferences.start()).not.toThrow()
    expect(preferences.source.get()).toEqual({ status: 'unavailable', reason: 'unauthorized' })
    result = { revision: 1, value: DEFAULT_WORKSPACE_PREFERENCES }
    update()
    expect(preferences.source.get()).toEqual({
      status: 'ready',
      snapshot: result,
      pendingChanges: 0,
    })

    preferences.dispose()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
