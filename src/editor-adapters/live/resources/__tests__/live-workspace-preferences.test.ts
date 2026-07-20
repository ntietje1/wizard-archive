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
    result = DEFAULT_WORKSPACE_PREFERENCES
    update()
    expect(preferences.source.get()).toEqual({
      status: 'ready',
      value: result,
    })

    preferences.dispose()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('uses the Convex optimistic query update and rolls it back after rejection', async () => {
    let update: () => void = () => undefined
    let result = DEFAULT_WORKSPACE_PREFERENCES
    const campaignId = testDomainId('campaign', 'preferences-optimistic')
    const convex = {
      mutation: vi.fn(async (_reference, args, options) => {
        options.optimisticUpdate(
          {
            getQuery: () => result,
            setQuery: (
              _query: unknown,
              _queryArgs: unknown,
              value: typeof DEFAULT_WORKSPACE_PREFERENCES,
            ) => {
              result = value
            },
          },
          args,
        )
        update()
        await Promise.resolve()
        result = DEFAULT_WORKSPACE_PREFERENCES
        update()
        throw new Error('rejected')
      }),
      watchQuery: () => ({
        localQueryResult: () => result,
        onUpdate: (listener: () => void) => {
          update = listener
          return () => {}
        },
      }),
    } as unknown as ConvexReactClient
    const preferences = createLiveWorkspacePreferences(campaignId, convex)
    preferences.start()

    const mutation = preferences.source.patch({ field: 'mode', value: 'viewer' })
    expect(preferences.source.get()).toMatchObject({
      status: 'ready',
      value: { mode: 'viewer' },
    })
    await expect(mutation).rejects.toThrow('rejected')
    expect(preferences.source.get()).toEqual({
      status: 'ready',
      value: DEFAULT_WORKSPACE_PREFERENCES,
    })
  })

  it('ignores mutation response order and follows only the subscribed value', async () => {
    let update: () => void = () => undefined
    let result = DEFAULT_WORKSPACE_PREFERENCES
    const mutations = [deferred<null>(), deferred<null>()]
    const convex = {
      mutation: vi
        .fn()
        .mockReturnValueOnce(mutations[0]!.promise)
        .mockReturnValueOnce(mutations[1]!.promise),
      watchQuery: () => ({
        localQueryResult: () => result,
        onUpdate: (listener: () => void) => {
          update = listener
          return () => {}
        },
      }),
    } as unknown as ConvexReactClient
    const preferences = createLiveWorkspacePreferences(
      testDomainId('campaign', 'preferences-order'),
      convex,
    )
    preferences.start()

    const first = preferences.source.patch({ field: 'mode', value: 'viewer' })
    const second = preferences.source.patch({ field: 'mode', value: 'editor' })
    result = { ...DEFAULT_WORKSPACE_PREFERENCES, mode: 'editor' }
    update()
    mutations[1]!.resolve(null)
    await second
    mutations[0]!.resolve(null)
    await first

    expect(preferences.source.get()).toEqual({ status: 'ready', value: result })
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}
