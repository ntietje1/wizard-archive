import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteWithContent } from 'shared/notes/types'
import type { Id } from 'convex/_generated/dataModel'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { SidebarItemEditor } from '../sidebar-item-editor'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'

vi.mock('../note/note-editor', () => ({ NoteEditor: () => <div>note editor</div> }))
vi.mock('../map/map-viewer', () => ({ MapViewer: () => <div /> }))
vi.mock('../folder/folder-viewer', () => ({ FolderViewer: () => <div /> }))
vi.mock('../file/file-viewer', () => ({ FileViewer: () => <div /> }))
vi.mock('~/features/canvas/components/canvas-viewer', () => ({ CanvasViewer: () => <div /> }))
vi.mock('../history-preview-viewer', () => ({
  HistoryPreviewViewer: ({ itemId, entryId }: { itemId: string; entryId: string }) => (
    <div data-testid="history-preview" data-item-id={itemId} data-entry-id={entryId} />
  ),
}))
vi.mock('../rollback-confirm-dialog', () => ({ RollbackConfirmDialog: () => null }))

describe('SidebarItemEditor', () => {
  beforeEach(() => {
    useHistoryPreviewStore.setState({ preview: null, rollback: null })
  })

  it('renders the editor for a loaded item', () => {
    const item: NoteWithContent = {
      ...createNote(),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }

    render(<SidebarItemEditor item={item} />)

    expect(screen.getByText('note editor')).toBeInTheDocument()
  })

  it('renders preview only for the current item session', () => {
    const firstItem: NoteWithContent = {
      ...createNote({ _id: 'note-1' as Id<'sidebarItems'> }),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }
    const secondItem: NoteWithContent = {
      ...createNote({ _id: 'note-2' as Id<'sidebarItems'> }),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }
    useHistoryPreviewStore
      .getState()
      .setPreviewingEntry(firstItem._id, 'history-1' as Id<'editHistory'>)

    const { rerender } = render(<SidebarItemEditor item={firstItem} />)

    expect(screen.getByTestId('history-preview')).toHaveAttribute('data-item-id', firstItem._id)

    rerender(<SidebarItemEditor item={secondItem} />)

    expect(screen.queryByTestId('history-preview')).not.toBeInTheDocument()
    expect(screen.getByText('note editor')).toBeInTheDocument()
  })
})
