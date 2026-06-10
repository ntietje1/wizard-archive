import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { LiveRollbackConfirmDialog } from '../live-rollback-confirm-dialog'
import { RollbackConfirmDialog } from '../rollback-confirm-dialog'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import type { Id } from 'convex/_generated/dataModel'

const { mutateAsyncMock, useCampaignQueryMock } = vi.hoisted(() => ({
  mutateAsyncMock: vi.fn(),
  useCampaignQueryMock: vi.fn(),
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    documentSnapshots: {
      mutations: {
        rollbackToSnapshot: 'rollbackToSnapshot',
      },
    },
    editHistory: {
      queries: {
        getHistoryEntry: 'getHistoryEntry',
      },
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

describe('RollbackConfirmDialog', () => {
  it('renders ready details and delegates restore', () => {
    const onOpenChange = vi.fn()
    const onRestore = vi.fn()

    render(
      <RollbackConfirmDialog
        state={{
          status: 'ready',
          entryTime: Date.UTC(2026, 0, 1),
          isRestoring: false,
        }}
        onOpenChange={onOpenChange}
        onRestore={onRestore}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    expect(screen.getByText('Restore this version?')).toBeInTheDocument()
    expect(onRestore).toHaveBeenCalled()
  })
})

describe('LiveRollbackConfirmDialog', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset()
    useCampaignQueryMock.mockReset()
    vi.mocked(toast.success).mockReset()
    useHistoryPreviewStore.setState({ preview: null, rollback: null })
  })

  it('loads rollback details and restores through the live source', async () => {
    const itemId = 'note-1' as Id<'sidebarItems'>
    const entryId = 'history-1' as Id<'editHistory'>
    useHistoryPreviewStore.getState().setPreviewingEntry(itemId, entryId)
    useHistoryPreviewStore.getState().setRollbackEntry(itemId, entryId)
    useCampaignQueryMock.mockReturnValue({
      data: { _creationTime: Date.UTC(2026, 0, 1) },
      error: null,
      isLoading: false,
    })
    mutateAsyncMock.mockResolvedValue(undefined)

    render(<LiveRollbackConfirmDialog itemId={itemId} />)

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledWith({ editHistoryId: entryId }))
    expect(useCampaignQueryMock).toHaveBeenCalledWith('getHistoryEntry', { editHistoryId: entryId })
    expect(toast.success).toHaveBeenCalledWith('Version restored')
    expect(useHistoryPreviewStore.getState().preview).toBeNull()
    expect(useHistoryPreviewStore.getState().rollback).toBeNull()
  })
})
