import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { toast } from 'sonner'
import { useLiveWorkspaceHistory } from '~/editor-adapters/live/use-live-workspace-history'
import type { Id } from 'convex/_generated/dataModel'

const { actionMock, useCampaignQueryMock } = vi.hoisted(() => ({
  actionMock: vi.fn(),
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

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@convex-dev/react-query', () => ({
  useConvex: () => ({ action: actionMock }),
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
  useAuthPaginatedQuery: () => ({
    results: [],
    status: 'Exhausted',
    loadMore: vi.fn(),
  }),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({ data: null, isLoading: false }),
}))

describe('useLiveWorkspaceHistory rollback details', () => {
  beforeEach(() => {
    actionMock.mockReset()
    useCampaignQueryMock.mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it('loads rollback details and restores through the live source', async () => {
    const entryId = 'history-1' as Id<'editHistory'>
    useCampaignQueryMock.mockReturnValue({
      data: { _creationTime: Date.UTC(2026, 0, 1) },
      error: null,
      isLoading: false,
    })
    actionMock.mockResolvedValue({
      status: 'restored',
      historyEntryId: 'history-2',
      preservedHistoryEntryId: 'history-3',
      restoredFromHistoryEntryId: entryId,
      restoredItemId: 'item-1',
    })

    const { result } = renderHook(() => {
      const history = useLiveWorkspaceHistory({
        canEdit: true,
        itemId: 'item-1' as Id<'sidebarItems'>,
        controls: historyControls({ rollbackEntryId: entryId }),
      })
      return {
        restoreRollback: history.status === 'available' ? history.restoreRollback : null,
        rollbackState: history.status === 'available' ? history.rollback : null,
      }
    })

    expect(result.current.rollbackState).toMatchObject({
      status: 'ready',
      entryTime: Date.UTC(2026, 0, 1),
    })

    await act(async () => {
      await result.current.restoreRollback?.(entryId)
    })

    await waitFor(() =>
      expect(actionMock).toHaveBeenCalledWith('rollbackToSnapshot', {
        campaignId: 'campaign-1',
        editHistoryId: entryId,
      }),
    )
    expect(useCampaignQueryMock).toHaveBeenCalledWith('getHistoryEntry', { editHistoryId: entryId })
    expect(toast.success).toHaveBeenCalledWith('Version restored')
  })

  it('reports loaded rollback entries without history data as unavailable', () => {
    const entryId = 'history-1' as Id<'editHistory'>
    useCampaignQueryMock.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
    })

    const { result } = renderHook(() => {
      const history = useLiveWorkspaceHistory({
        canEdit: true,
        itemId: 'item-1' as Id<'sidebarItems'>,
        controls: historyControls({ rollbackEntryId: entryId }),
      })
      return history.status === 'available' ? history.rollback : null
    })

    expect(result.current).toMatchObject({
      status: 'error',
      isRestoring: false,
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
