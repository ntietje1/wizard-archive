import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteWithContent } from 'shared/notes/types'
import type { Id } from 'convex/_generated/dataModel'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { SidebarItemEditor } from '../sidebar-item-editor'
import { SidebarItemViewer } from '../sidebar-item-viewer'
import type { EditorWorkspaceSource } from '~/features/editor/workspace/editor-workspace-source'
import type { FileViewerSource } from '../file/file-viewer-source'

vi.mock('../note/note-editor', () => ({ NoteEditor: () => <div>note editor</div> }))
vi.mock('../map/map-viewer', () => ({ MapViewer: () => <div /> }))
vi.mock('../folder/folder-viewer', () => ({ FolderViewer: () => <div /> }))
vi.mock('../file/file-viewer', () => ({ FileViewer: () => <div /> }))
vi.mock('~/features/canvas/components/canvas-viewer', () => ({ CanvasViewer: () => <div /> }))

describe('SidebarItemEditor', () => {
  const clearItemSession = vi.fn()

  beforeEach(() => {
    clearItemSession.mockReset()
  })

  it('renders the editor for a loaded item', () => {
    const item: NoteWithContent = {
      ...createNote(),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }

    render(<SidebarItemEditor files={createFiles()} item={item} history={createHistory()} />)

    expect(screen.getByText('note editor')).toBeInTheDocument()
  })

  it('dispatches loaded item content without history wrapper state', () => {
    const item: NoteWithContent = {
      ...createNote(),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }

    render(<SidebarItemViewer item={item} />)

    expect(screen.getByText('note editor')).toBeInTheDocument()
  })

  it('renders the source-provided history preview when present', () => {
    const item: NoteWithContent = {
      ...createNote({ _id: 'note-1' as Id<'sidebarItems'> }),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }
    const entryId = 'history-1' as Id<'editHistory'>

    render(
      <SidebarItemEditor
        files={createFiles()}
        item={item}
        history={createHistory({ previewingEntryId: entryId })}
      />,
    )

    expect(screen.getByTestId('history-preview')).toHaveAttribute('data-item-id', item._id)
    expect(screen.getByTestId('history-preview')).toHaveAttribute('data-entry-id', entryId)
    expect(screen.queryByText('note editor')).not.toBeInTheDocument()
  })

  it('clears the source-owned history session when the item unmounts', () => {
    const item: NoteWithContent = {
      ...createNote({ _id: 'note-1' as Id<'sidebarItems'> }),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }

    const { unmount } = render(
      <SidebarItemEditor files={createFiles()} item={item} history={createHistory()} />,
    )

    unmount()

    expect(clearItemSession).toHaveBeenCalledWith(item._id)
  })

  function createHistory({
    previewingEntryId = null,
  }: {
    previewingEntryId?: Id<'editHistory'> | null
  } = {}): EditorWorkspaceSource['history'] {
    return {
      preview: {
        previewingEntryId,
        clearItemSession,
        PreviewComponent: ({ itemId, entryId }) => (
          <div data-testid="history-preview" data-item-id={itemId} data-entry-id={entryId} />
        ),
      },
      rollback: {
        DialogComponent: ({ itemId }) => (
          <div data-testid="rollback-dialog" data-item-id={itemId} />
        ),
      },
    }
  }

  function createFiles(): EditorWorkspaceSource['files'] {
    return {
      viewer: createFileViewerSource(),
    }
  }

  function createFileViewerSource(): FileViewerSource {
    return {
      resolveFile: (file) => ({
        allowObjectUrl: false,
        contentType: file.contentType,
        downloadUrl: file.downloadUrl,
        name: file.name,
        size: null,
      }),
      getEmptyFileUpload: () => null,
    }
  }
})
