import { testResourceId } from '../../../../../shared/test/resource-id'
import { testCampaignId } from '../../../../../shared/test/campaign-id'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { renderHook } from '@testing-library/react'
import * as Y from 'yjs'
import { useConvexYjsCollaboration } from '../yjs-collaboration'
import type { YjsCollaborationProvider } from '@wizard-archive/editor/collaboration/yjs-provider'

const DOCUMENT_ID = testResourceId('test-doc-id')
const CAMPAIGN_ID = testCampaignId('test-campaign-id')
const OTHER_CAMPAIGN_ID = testCampaignId('other-campaign-id')
const USER = { name: 'Test User', color: '#ff0000' }
const AWARENESS_LEASE_ID = 'awareness-lease-id'

const {
  mockMutation,
  mockConvexClient,
  mockUseAuthPaginatedQuery,
  mockUseYjsCollaborationSession,
} = vi.hoisted(() => {
  const mutation = vi.fn().mockResolvedValue(null)
  return {
    mockMutation: mutation,
    mockConvexClient: { mutation },
    mockUseAuthPaginatedQuery: vi.fn().mockReturnValue({
      loadMore: vi.fn(),
      results: [],
      status: 'LoadingFirstPage',
    }),
    mockUseYjsCollaborationSession: vi.fn().mockReturnValue({
      doc: null,
      provider: null,
      instanceId: 0,
      isLoading: true,
      error: null,
    }),
  }
})

vi.mock('convex/_generated/api', () => ({
  api: {
    yjsSync: {
      queries: { getUpdates: 'getUpdates', getAwareness: 'getAwareness' },
      mutations: {
        pushUpdate: 'pushUpdate',
        pushAwareness: 'pushAwareness',
        removeAwareness: 'removeAwareness',
      },
    },
  },
}))

vi.mock('@convex-dev/react-query', () => ({
  useConvex: () => mockConvexClient,
}))

vi.mock('~/shared/hooks/useAuthPaginatedQuery', () => ({
  useAuthPaginatedQuery: (...args: Array<unknown>) => mockUseAuthPaginatedQuery(...args),
}))

vi.mock('@wizard-archive/editor/adapter', async (importOriginal) => ({
  ...(await importOriginal()),
  useWizardEditorYjsCollaborationSession: (...args: Array<unknown>) =>
    mockUseYjsCollaborationSession(...args),
}))

describe('useConvexYjsCollaboration', () => {
  beforeEach(() => {
    mockMutation.mockClear()
    mockMutation.mockResolvedValue(null)
    mockUseAuthPaginatedQuery.mockReset()
    mockUseAuthPaginatedQuery.mockReturnValue({
      loadMore: vi.fn(),
      results: [],
      status: 'LoadingFirstPage',
    })
    mockUseYjsCollaborationSession.mockClear()
    mockUseYjsCollaborationSession.mockReturnValue({
      doc: null,
      provider: null,
      instanceId: 0,
      isLoading: true,
      error: null,
    })
  })

  it('mounts the editor collaboration session with the current workspace source', () => {
    const session = {
      doc: new Y.Doc(),
      provider: { awareness: {} } as YjsCollaborationProvider,
      instanceId: 7,
      isLoading: false,
      error: null,
    }
    mockUseYjsCollaborationSession.mockReturnValue(session)

    const { result } = renderHook(() =>
      useConvexYjsCollaboration(CAMPAIGN_ID, DOCUMENT_ID, USER, true),
    )

    expect(result.current).toBe(session)
    expect(mockUseYjsCollaborationSession).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: true,
        documentId: DOCUMENT_ID,
        sourceId: CAMPAIGN_ID,
        user: USER,
        useAwareness: expect.any(Function),
        useUpdates: expect.any(Function),
      }),
    )
  })

  it('routes editor session transport callbacks through Convex mutations with source context', async () => {
    renderHook(() => useConvexYjsCollaboration(CAMPAIGN_ID, DOCUMENT_ID, USER, true))
    const [{ transport }] = mockUseYjsCollaborationSession.mock.calls[0]
    const update = new ArrayBuffer(1)
    const awarenessState = new ArrayBuffer(2)

    await transport.pushUpdate({
      documentId: DOCUMENT_ID,
      sourceId: CAMPAIGN_ID,
      update,
    })
    await transport.pushAwareness({
      documentId: DOCUMENT_ID,
      sourceId: CAMPAIGN_ID,
      clientId: 123,
      leaseId: AWARENESS_LEASE_ID,
      state: awarenessState,
    })
    await transport.removeAwareness({
      documentId: DOCUMENT_ID,
      sourceId: CAMPAIGN_ID,
      clientId: 123,
      leaseId: AWARENESS_LEASE_ID,
    })

    expect(mockMutation).toHaveBeenCalledWith('pushUpdate', {
      campaignId: CAMPAIGN_ID,
      documentId: DOCUMENT_ID,
      update,
    })
    expect(mockMutation).toHaveBeenCalledWith('pushAwareness', {
      campaignId: CAMPAIGN_ID,
      clientId: 123,
      documentId: DOCUMENT_ID,
      leaseId: AWARENESS_LEASE_ID,
      state: awarenessState,
    })
    expect(mockMutation).toHaveBeenCalledWith('removeAwareness', {
      campaignId: CAMPAIGN_ID,
      clientId: 123,
      documentId: DOCUMENT_ID,
      leaseId: AWARENESS_LEASE_ID,
    })
  })

  it('rejects transport callbacks without a workspace source context', async () => {
    renderHook(() => useConvexYjsCollaboration(CAMPAIGN_ID, DOCUMENT_ID, USER, true))
    const [{ transport }] = mockUseYjsCollaborationSession.mock.calls[0]

    await expect(
      transport.pushUpdate({
        documentId: DOCUMENT_ID,
        sourceId: null,
        update: new ArrayBuffer(1),
      }),
    ).rejects.toThrow('Yjs workspace source id is required')
    await expect(
      transport.pushAwareness({
        clientId: 123,
        documentId: DOCUMENT_ID,
        leaseId: AWARENESS_LEASE_ID,
        sourceId: null,
        state: new ArrayBuffer(1),
      }),
    ).rejects.toThrow('Yjs workspace source id is required')
    await expect(
      transport.removeAwareness({
        clientId: 123,
        documentId: DOCUMENT_ID,
        leaseId: AWARENESS_LEASE_ID,
        sourceId: null,
      }),
    ).rejects.toThrow('Yjs workspace source id is required')
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('supplies workspace-backed update and awareness hooks to the editor session', () => {
    const updates = {
      loadMore: vi.fn(),
      results: [{ seq: 1, update: new ArrayBuffer(1) }],
      status: 'Exhausted',
    }
    const awareness = {
      loadMore: vi.fn(),
      results: [{ clientId: 2, state: new ArrayBuffer(1), updatedAt: 1 }],
      status: 'Exhausted',
    }
    mockUseAuthPaginatedQuery.mockReturnValueOnce(updates).mockReturnValueOnce(awareness)

    renderHook(() => useConvexYjsCollaboration(CAMPAIGN_ID, DOCUMENT_ID, USER, true))
    const [{ useUpdates, useAwareness }] = mockUseYjsCollaborationSession.mock.calls[0]

    expect(
      useUpdates({ documentId: DOCUMENT_ID, afterSeq: 3, sourceId: OTHER_CAMPAIGN_ID }),
    ).toEqual({
      data: updates.results,
      isComplete: true,
      loadMore: undefined,
    })
    expect(useAwareness({ documentId: DOCUMENT_ID, sourceId: OTHER_CAMPAIGN_ID })).toEqual({
      data: awareness.results,
      isComplete: true,
      loadMore: undefined,
    })
    expect(mockUseAuthPaginatedQuery).toHaveBeenCalledWith(
      'getUpdates',
      {
        campaignId: OTHER_CAMPAIGN_ID,
        documentId: DOCUMENT_ID,
        afterSeq: 3,
      },
      { initialNumItems: 100 },
    )
    expect(mockUseAuthPaginatedQuery).toHaveBeenCalledWith(
      'getAwareness',
      {
        campaignId: OTHER_CAMPAIGN_ID,
        documentId: DOCUMENT_ID,
      },
      { initialNumItems: 100 },
    )
  })

  it('exposes paginated update loaders while a Yjs page can load more', () => {
    const loadMore = vi.fn()
    mockUseAuthPaginatedQuery.mockReturnValue({
      loadMore,
      results: [{ seq: 1, update: new ArrayBuffer(1) }],
      status: 'CanLoadMore',
    })

    renderHook(() => useConvexYjsCollaboration(CAMPAIGN_ID, DOCUMENT_ID, USER, true))
    const [{ useUpdates }] = mockUseYjsCollaborationSession.mock.calls[0]

    const result = useUpdates({ documentId: DOCUMENT_ID, afterSeq: 3, sourceId: CAMPAIGN_ID })

    expect(result).toMatchObject({
      data: [{ seq: 1, update: expect.any(ArrayBuffer) }],
      isComplete: false,
    })

    result.loadMore?.()
    expect(loadMore).toHaveBeenCalledWith(100)
  })

  it('skips update and awareness reads without a workspace source context', () => {
    renderHook(() => useConvexYjsCollaboration(CAMPAIGN_ID, DOCUMENT_ID, USER, true))
    const [{ useUpdates, useAwareness }] = mockUseYjsCollaborationSession.mock.calls[0]

    useUpdates({ documentId: DOCUMENT_ID, afterSeq: 3, sourceId: null })
    useAwareness({ documentId: DOCUMENT_ID, sourceId: null })

    expect(mockUseAuthPaginatedQuery).toHaveBeenCalledWith('getUpdates', 'skip', {
      initialNumItems: 100,
    })
    expect(mockUseAuthPaginatedQuery).toHaveBeenCalledWith('getAwareness', 'skip', {
      initialNumItems: 100,
    })
  })

  it('maps editor cleanup source id back to the live workspace source id', async () => {
    const doc = new Y.Doc()
    const provider = { awareness: {} } as YjsCollaborationProvider
    const onBeforeDestroy = vi.fn()

    renderHook(() =>
      useConvexYjsCollaboration(CAMPAIGN_ID, DOCUMENT_ID, USER, true, {
        onBeforeDestroy,
      }),
    )
    const [{ onBeforeDestroy: handleBeforeDestroy }] = mockUseYjsCollaborationSession.mock.calls[0]

    await handleBeforeDestroy({
      documentId: DOCUMENT_ID,
      doc,
      provider,
      sourceId: CAMPAIGN_ID,
    })

    expect(onBeforeDestroy).toHaveBeenCalledWith({
      documentId: DOCUMENT_ID,
      doc,
      provider,
      sourceId: CAMPAIGN_ID,
    })
  })
})
