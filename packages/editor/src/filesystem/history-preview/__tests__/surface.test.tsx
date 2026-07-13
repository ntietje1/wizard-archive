import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { EditHistoryId, SidebarItemId } from '../../../../../../shared/common/ids'
import type { ResourceHistoryAvailable } from '../../history-types'
import { HistoryPreviewSurface } from '../surface'

vi.mock('../viewer', () => ({
  HistoryPreviewViewer: () => <div>History preview</div>,
}))

vi.mock('../rollback-confirm-dialog', () => ({
  RollbackConfirmDialog: () => null,
}))

describe('HistoryPreviewSurface', () => {
  it('does not show another item history preview', () => {
    render(
      <HistoryPreviewSurface
        canEdit
        history={historyFor('note-1' as SidebarItemId)}
        itemId={'note-2' as SidebarItemId}
      >
        <div>Current item</div>
      </HistoryPreviewSurface>,
    )

    expect(screen.getByText('Current item')).toBeInTheDocument()
    expect(screen.queryByText('History preview')).not.toBeInTheDocument()
  })

  it('shows the preview for its own item', () => {
    const itemId = 'note-1' as SidebarItemId
    render(
      <HistoryPreviewSurface canEdit history={historyFor(itemId)} itemId={itemId}>
        <div>Current item</div>
      </HistoryPreviewSurface>,
    )

    expect(screen.getByText('History preview')).toBeInTheDocument()
    expect(screen.queryByText('Current item')).not.toBeInTheDocument()
  })
})

function historyFor(itemId: SidebarItemId): ResourceHistoryAvailable {
  return {
    status: 'available',
    itemId,
    entries: {
      loadMore: vi.fn(),
      state: {
        canEdit: true,
        entries: [],
        membersMap: new Map(),
        myMemberId: null,
        previewingEntryId: 'history-1' as EditHistoryId,
        status: 'Exhausted',
      },
    },
    previewingEntryId: 'history-1' as EditHistoryId,
    preview: { status: 'loading', entryTime: 1 },
    previewEntry: vi.fn(),
    rollbackEntryId: null,
    rollback: { status: 'closed', isRestoring: false },
    requestRollback: vi.fn(),
    restoreRollback: vi.fn(),
    clearPreview: vi.fn(),
    clearRollback: vi.fn(),
    clearItemSession: vi.fn(),
  }
}
