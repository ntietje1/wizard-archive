import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import * as Y from 'yjs'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { WizardEditorHistoryInput } from '@wizard-archive/editor/adapter'
import { useLiveWorkspaceHistory } from '~/editor-adapters/live/use-live-workspace-history'

import { testHistoryEntryId } from 'shared/test/history-entry-id'
import { testAssetId } from 'shared/test/asset-id'

type HistorySnapshot = NonNullable<WizardEditorHistoryInput['preview']['snapshot']>
const { useAuthPaginatedQueryMock, useCampaignQueryMock } = vi.hoisted(() => ({
  useAuthPaginatedQueryMock: vi.fn(),
  useCampaignQueryMock: vi.fn(),
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    documentSnapshots: {
      actions: {
        rollbackToSnapshot: 'rollbackToSnapshot',
      },
      queries: {
        getHistoryPreview: 'getHistoryPreview',
      },
    },
    editHistory: {
      queries: {
        getHistoryEntry: 'getHistoryEntry',
        getItemHistory: 'getItemHistory',
      },
    },
  },
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaign: { data: { myMembership: null } },
    campaignId: 'campaign-1',
  }),
}))

vi.mock('~/features/campaigns/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => ({ data: [], isPending: false }),
}))

vi.mock('~/shared/hooks/useAuthPaginatedQuery', () => ({
  useAuthPaginatedQuery: (...args: Array<unknown>) => useAuthPaginatedQueryMock(...args),
}))

vi.mock('@convex-dev/react-query', () => ({
  useConvex: () => ({ action: vi.fn() }),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: vi.fn(),
}))

function encodeSnapshot(doc: Y.Doc): ArrayBuffer {
  const update = Y.encodeStateAsUpdate(doc)
  const copy = new Uint8Array(update.byteLength)
  copy.set(update)
  return copy.buffer as ArrayBuffer
}

function mockHistoryPreviewQueries({
  historyEntry,
  snapshot,
}: {
  historyEntry: unknown
  snapshot: unknown
}) {
  useCampaignQueryMock
    .mockReturnValueOnce(snapshot)
    .mockReturnValueOnce(historyEntry)
    .mockReturnValue({ data: null, isLoading: false, error: null })
}

describe('useLiveWorkspaceHistory preview state', () => {
  beforeEach(() => {
    useAuthPaginatedQueryMock.mockReset()
    useAuthPaginatedQueryMock.mockReturnValue({
      results: [],
      status: 'Exhausted',
      loadMore: vi.fn(),
    })
    useCampaignQueryMock.mockReset()
  })

  it('loads snapshot and history entry through the live source wrapper', () => {
    const noteId = 'note-1' as ResourceId
    const entryId = testHistoryEntryId('history-1')
    const doc = new Y.Doc()
    const snapshotData = encodeSnapshot(doc)
    doc.destroy()
    mockHistoryPreviewQueries({
      snapshot: {
        data: { kind: 'note-yjs', noteId, data: snapshotData } satisfies HistorySnapshot,
        isLoading: false,
        error: null,
      },
      historyEntry: {
        data: { createdAt: 1 },
        isLoading: false,
        error: null,
      },
    })
    const { result } = renderHook(() => {
      const history = useLiveWorkspaceHistory({
        canEdit: true,
        itemId: noteId,
        controls: historyControls({ previewingEntryId: entryId }),
      })
      return history.status === 'available' ? history.preview : null
    })

    expect(result.current).toMatchObject({
      status: 'ready',
      entryTime: 1,
      snapshot: { kind: 'note-yjs', noteId, data: snapshotData },
    })
    expect(useCampaignQueryMock).toHaveBeenNthCalledWith(1, 'getHistoryPreview', {
      editHistoryId: entryId,
    })
    expect(useCampaignQueryMock).toHaveBeenNthCalledWith(2, 'getHistoryEntry', {
      editHistoryId: entryId,
    })
  })

  it('does not enable live history queries for non-persisted item ids', () => {
    const optimisticItemId = 'optimistic-create-1' as ResourceId
    const previewEntryId = testHistoryEntryId('history-1')
    const rollbackEntryId = testHistoryEntryId('history-2')
    useCampaignQueryMock.mockReturnValue({ data: null, isLoading: false, error: null })

    const { result } = renderHook(() =>
      useLiveWorkspaceHistory({
        canEdit: true,
        itemId: optimisticItemId,
        controls: historyControls({
          previewingEntryId: previewEntryId,
          rollbackEntryId,
        }),
      }),
    )

    expect(result.current).toEqual({ status: 'unsupported', reason: 'not_implemented' })
    expect(useAuthPaginatedQueryMock).toHaveBeenCalledWith(
      'getItemHistory',
      'skip',
      expect.any(Object),
    )
    expect(useCampaignQueryMock).toHaveBeenCalledTimes(3)
    for (const call of useCampaignQueryMock.mock.calls) {
      expect(call[1]).toBe('skip')
    }
  })

  it('does not query edit-only item history for view-only access', () => {
    const noteId = 'note-1' as ResourceId
    const entryId = testHistoryEntryId('history-1')
    useCampaignQueryMock.mockReturnValue({ data: null, isLoading: false, error: null })

    const { result } = renderHook(() =>
      useLiveWorkspaceHistory({
        canEdit: false,
        itemId: noteId,
        controls: historyControls({
          previewingEntryId: entryId,
          rollbackEntryId: entryId,
        }),
      }),
    )

    expect(result.current).toMatchObject({
      status: 'available',
      entries: {
        state: {
          canEdit: false,
          entries: [],
        },
      },
    })
    expect(useAuthPaginatedQueryMock).toHaveBeenCalledWith(
      'getItemHistory',
      'skip',
      expect.any(Object),
    )
    expect(useCampaignQueryMock).toHaveBeenCalledTimes(3)
    for (const call of useCampaignQueryMock.mock.calls) {
      expect(call[1]).toBe('skip')
    }
  })

  it('loads game-map snapshots with their live storage image URL', () => {
    const entryId = testHistoryEntryId('history-1')
    mockHistoryPreviewQueries({
      snapshot: {
        data: {
          kind: 'game-map',
          snapshotData: { imageAssetId: testAssetId('asset-1'), pins: [] },
          imageUrlState: { status: 'ready', url: 'https://example.test/map.png' },
        } satisfies HistorySnapshot,
        isLoading: false,
        error: null,
      },
      historyEntry: {
        data: { createdAt: 2 },
        isLoading: false,
        error: null,
      },
    })

    const { result } = renderHook(() => {
      const history = useLiveWorkspaceHistory({
        canEdit: true,
        itemId: 'map-1' as ResourceId,
        controls: historyControls({ previewingEntryId: entryId }),
      })
      return history.status === 'available' ? history.preview : null
    })

    expect(result.current).toMatchObject({
      status: 'ready',
      entryTime: 2,
      snapshot: {
        kind: 'game-map',
        snapshotData: { imageAssetId: testAssetId('asset-1'), pins: [] },
        imageUrlState: { status: 'ready', url: 'https://example.test/map.png' },
      },
    })
    expect(useCampaignQueryMock).toHaveBeenNthCalledWith(1, 'getHistoryPreview', {
      editHistoryId: entryId,
    })
  })

  it('reports loading preview state while snapshot or history entry is loading', () => {
    const entryId = testHistoryEntryId('history-1')
    mockHistoryPreviewQueries({
      snapshot: {
        data: undefined,
        isLoading: true,
        error: null,
      },
      historyEntry: {
        data: { createdAt: 4 },
        isLoading: false,
        error: null,
      },
    })

    const { result } = renderHook(() => {
      const history = useLiveWorkspaceHistory({
        canEdit: true,
        itemId: 'note-1' as ResourceId,
        controls: historyControls({ previewingEntryId: entryId }),
      })
      return history.status === 'available' ? history.preview : null
    })

    expect(result.current).toEqual({ status: 'loading', entryTime: 4 })
  })

  it('reports error preview state when live snapshot loading fails', () => {
    const entryId = testHistoryEntryId('history-1')
    mockHistoryPreviewQueries({
      snapshot: {
        data: null,
        isLoading: false,
        error: new Error('snapshot failed'),
      },
      historyEntry: {
        data: { createdAt: 5 },
        isLoading: false,
        error: null,
      },
    })

    const { result } = renderHook(() => {
      const history = useLiveWorkspaceHistory({
        canEdit: true,
        itemId: 'note-1' as ResourceId,
        controls: historyControls({ previewingEntryId: entryId }),
      })
      return history.status === 'available' ? history.preview : null
    })

    expect(result.current).toEqual({ status: 'error', entryTime: 5 })
  })

  it('loads canvas Yjs snapshots as canvas preview state', () => {
    const canvasId = 'canvas-1' as ResourceId
    const entryId = testHistoryEntryId('history-1')
    const doc = new Y.Doc()
    const snapshotData = encodeSnapshot(doc)
    doc.destroy()
    mockHistoryPreviewQueries({
      snapshot: {
        data: { kind: 'canvas-yjs', canvasId, data: snapshotData } satisfies HistorySnapshot,
        isLoading: false,
        error: null,
      },
      historyEntry: {
        data: { createdAt: 6 },
        isLoading: false,
        error: null,
      },
    })

    const { result } = renderHook(() => {
      const history = useLiveWorkspaceHistory({
        canEdit: true,
        itemId: canvasId,
        controls: historyControls({ previewingEntryId: entryId }),
      })
      return history.status === 'available' ? history.preview : null
    })

    expect(result.current).toMatchObject({
      status: 'ready',
      entryTime: 6,
      snapshot: { kind: 'canvas-yjs', canvasId, data: snapshotData },
    })
  })

  it('passes explicit unsupported snapshot content through the live source', () => {
    const entryId = testHistoryEntryId('history-1')
    mockHistoryPreviewQueries({
      snapshot: {
        data: { kind: 'unsupported' } satisfies HistorySnapshot,
        isLoading: false,
        error: null,
      },
      historyEntry: {
        data: { createdAt: 3 },
        isLoading: false,
        error: null,
      },
    })

    const { result } = renderHook(() => {
      const history = useLiveWorkspaceHistory({
        canEdit: true,
        itemId: 'note-1' as ResourceId,
        controls: historyControls({ previewingEntryId: entryId }),
      })
      return history.status === 'available' ? history.preview : null
    })

    expect(result.current).toEqual({
      status: 'ready',
      entryTime: 3,
      snapshot: { kind: 'unsupported' },
    })
  })
})

type LiveHistoryControls = Parameters<typeof useLiveWorkspaceHistory>[0]['controls']

function historyControls(overrides: Partial<LiveHistoryControls> = {}): LiveHistoryControls {
  return {
    previewingEntryId: null,
    rollbackEntryId: null,
    previewEntry: vi.fn(),
    requestRollback: vi.fn(),
    clearPreview: vi.fn(),
    clearRollback: vi.fn(),
    clearItemSession: vi.fn(),
    ...overrides,
  }
}
