import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NoteWithContent } from 'shared/notes/types'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { SidebarItemEditor } from '../sidebar-item-editor'

vi.mock('../note/note-editor', () => ({ NoteEditor: () => <div>note editor</div> }))
vi.mock('../map/map-viewer', () => ({ MapViewer: () => <div /> }))
vi.mock('../folder/folder-viewer', () => ({ FolderViewer: () => <div /> }))
vi.mock('../file/file-viewer', () => ({ FileViewer: () => <div /> }))
vi.mock('~/features/canvas/components/canvas-viewer', () => ({ CanvasViewer: () => <div /> }))
vi.mock('../history-preview-viewer', () => ({ HistoryPreviewViewer: () => <div /> }))
vi.mock('../rollback-confirm-dialog', () => ({ RollbackConfirmDialog: () => null }))

describe('SidebarItemEditor', () => {
  it('renders the editor for a loaded item', () => {
    const item: NoteWithContent = {
      ...createNote(),
      ancestors: [],
      content: [],
      blockMeta: {},
    }

    render(<SidebarItemEditor item={item} />)

    expect(screen.getByText('note editor')).toBeInTheDocument()
  })
})
