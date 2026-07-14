import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { testHistoryEntryId } from '../../../test/history-entry-id'
import type { ResourceHistoryAvailable } from '../../history-types'
import type { HistoryRollbackResult } from '../../history-contract'
import { HistoryPreviewSurface } from '../surface'

const { rollbackDialogProps } = vi.hoisted(() => ({ rollbackDialogProps: vi.fn() }))

vi.mock('../viewer', () => ({
  HistoryPreviewViewer: () => <div>History preview</div>,
}))

vi.mock('../rollback-confirm-dialog', () => ({
  RollbackConfirmDialog: (props: unknown) => {
    rollbackDialogProps(props)
    return null
  },
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

  it('does not clear a newer history session when an older restore completes', async () => {
    let resolveRestore!: (value: HistoryRollbackResult) => void
    const restore = new Promise<HistoryRollbackResult>((resolve) => {
      resolveRestore = resolve
    })
    const firstHistory = historyFor('note-1' as SidebarItemId)
    firstHistory.rollbackEntryId = testHistoryEntryId('history-1')
    firstHistory.rollback = { status: 'ready', entryTime: 1, isRestoring: false }
    firstHistory.restoreRollback = vi.fn(() => restore)
    const { rerender } = render(
      <HistoryPreviewSurface canEdit history={firstHistory} itemId={firstHistory.itemId}>
        <div>Current item</div>
      </HistoryPreviewSurface>,
    )
    const onRestore = rollbackDialogProps.mock.lastCall?.[0].onRestore as () => void
    onRestore()

    const secondHistory = historyFor('note-2' as SidebarItemId)
    rerender(
      <HistoryPreviewSurface canEdit history={secondHistory} itemId={secondHistory.itemId}>
        <div>Current item</div>
      </HistoryPreviewSurface>,
    )
    resolveRestore({
      status: 'restored',
      historyEntryId: testHistoryEntryId('history-2'),
      preservedHistoryEntryId: testHistoryEntryId('history-3'),
      restoredFromHistoryEntryId: testHistoryEntryId('history-1'),
      restoredItemId: firstHistory.itemId,
    })
    await restore

    expect(firstHistory.clearPreview).not.toHaveBeenCalled()
    expect(firstHistory.clearRollback).not.toHaveBeenCalled()
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
        previewingEntryId: testHistoryEntryId('history-1'),
        status: 'Exhausted',
      },
    },
    previewingEntryId: testHistoryEntryId('history-1'),
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
