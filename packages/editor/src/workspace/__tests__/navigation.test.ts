import { testResourceId } from '../../../../../shared/test/resource-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import { resolveWorkspaceNavigationState } from '../runtime'
import { createTestWorkspaceRuntime } from '../../test/workspace-runtime-factory'

describe('workspace navigation', () => {
  it('resolves trash and requested item states before default workspace destinations', () => {
    const resourceId = testResourceId('note-1')

    expect(
      resolveWorkspaceNavigationState({
        canCreateDashboard: true,
        resourceId,
        isResourceRequested: true,
        isWorkspaceLoaded: true,
        trashRequested: true,
      }),
    ).toEqual({ kind: 'trash' })
    expect(
      resolveWorkspaceNavigationState({
        canCreateDashboard: true,
        resourceId,
        isResourceRequested: true,
        isWorkspaceLoaded: true,
        trashRequested: false,
      }),
    ).toEqual({ kind: 'resource', resourceId })
  })

  it('resolves loaded empty workspaces to create or empty based on capability', () => {
    expect(
      resolveWorkspaceNavigationState({
        canCreateDashboard: true,
        resourceId: null,
        isResourceRequested: false,
        isWorkspaceLoaded: true,
        trashRequested: false,
      }),
    ).toEqual({ kind: 'create' })
    expect(
      resolveWorkspaceNavigationState({
        canCreateDashboard: false,
        resourceId: null,
        isResourceRequested: false,
        isWorkspaceLoaded: true,
        trashRequested: false,
      }),
    ).toEqual({ kind: 'empty' })
  })

  it('resolves unloaded workspaces before default loaded destinations', () => {
    expect(
      resolveWorkspaceNavigationState({
        canCreateDashboard: true,
        resourceId: null,
        isResourceRequested: false,
        isWorkspaceLoaded: false,
        trashRequested: false,
      }),
    ).toEqual({ kind: 'empty' })
  })

  it('ignores an available resource when resource navigation was not requested', () => {
    const resourceId = testResourceId('note-1')

    expect(
      resolveWorkspaceNavigationState({
        canCreateDashboard: true,
        resourceId,
        isResourceRequested: false,
        isWorkspaceLoaded: true,
        trashRequested: false,
      }),
    ).toEqual({ kind: 'create' })
  })

  it('returns explicit external URL navigation results before adapter navigation is called', async () => {
    const openExternalUrl = vi.fn(() => ({ status: 'completed' as const }))
    const runtime = createTestWorkspaceRuntime({
      navigation: { openExternalUrl },
    })

    await expect(
      Promise.resolve(runtime.navigation.openExternalUrl('https://example.com/handout')),
    ).resolves.toEqual({ status: 'completed' })
    await expect(
      Promise.resolve(runtime.navigation.openExternalUrl('javascript:alert(1)')),
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'unsafe_external_url',
    })
    await expect(
      Promise.resolve(runtime.navigation.openExternalUrl('data:text/html,<p>unsafe</p>')),
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'unsafe_external_url',
    })
    await expect(Promise.resolve(runtime.navigation.openExternalUrl('not a url'))).resolves.toEqual(
      {
        status: 'unavailable',
        reason: 'invalid_external_url',
      },
    )

    expect(openExternalUrl).toHaveBeenCalledExactlyOnceWith('https://example.com/handout')
  })
})
