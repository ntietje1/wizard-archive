import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import {
  INITIAL_DEMO_WORKSPACE,
  createDemoWorkspaceProjection,
  demoWorkspaceReducer,
} from '../demo-workspace-model'
import {
  createLocalDemoEditorWorkspaceSource,
  useLocalDemoNoteDocuments,
} from '../local-demo-editor-workspace-source'
import type { Id } from 'convex/_generated/dataModel'
import type { FileViewerSource } from '~/features/editor/components/viewer/file/file-viewer-source'
import type {
  EditorWorkspaceNoteDocuments,
  EditorWorkspaceNoteEditableSession,
} from '~/features/editor/workspace/editor-workspace-source'
import { createTestCanvasViewerSource } from '~/test/factories/canvas-viewer-source-factory'
import type { NoteWithContent } from 'shared/notes/types'

describe('createLocalDemoEditorWorkspaceSource', () => {
  it('projects demo workspace state into the shared editor workspace source contract', () => {
    const dispatch = vi.fn()
    const source = createLocalDemoEditorWorkspaceSource({
      canvasViewerSource: createTestCanvasViewerSource(),
      dispatch,
      fileViewerSource: createFileViewerSource(),
      noteDocuments: createNoteDocuments(),
      workspace: INITIAL_DEMO_WORKSPACE,
    })

    expect(source.content.currentItem.contentItem).toMatchObject({
      _id: 'note-market',
      name: 'The Lantern Market',
      type: SIDEBAR_ITEM_TYPES.notes,
    })
    expect(source.content.currentItem.contentItem).toBe(
      source.index.activeItemsById.get('note-market' as Id<'sidebarItems'>),
    )
    expect(source.workspace.isDm).toBe(true)
    expect(source.permissions.canEdit).toBe(true)
    expect(source.sharing.visible).toBe(false)
    expect(source.history.preview.previewingEntryId).toBeNull()
    const { container } = render(
      createElement(source.history.preview.PreviewComponent, {
        itemId: 'note-market' as Id<'sidebarItems'>,
        entryId: 'history-1' as Id<'editHistory'>,
      }),
    )
    expect(container).toBeEmptyDOMElement()

    void source.items.renameItem(
      source.index.activeItemsById.get('canvas-heist' as Id<'sidebarItems'>)!,
      'Board',
    )
    expect(dispatch).toHaveBeenCalledWith({
      type: 'renameItem',
      itemId: 'canvas-heist',
      title: 'Board',
    })

    const created = source.items.createItem({
      type: SIDEBAR_ITEM_TYPES.notes,
      parentId: null,
      name: 'Local note',
    })
    expect(created).toEqual({ id: 'local-note-2', slug: 'local-note-2' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'createItem', commandKey: 'note' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'renameItem',
      itemId: 'local-note-2',
      title: 'Local note',
    })
  })

  it('uses the same canonical projection for source current item and embed resolution', () => {
    const workspace = demoWorkspaceReducer(INITIAL_DEMO_WORKSPACE, {
      type: 'selectItem',
      itemId: 'canvas-heist',
    })
    const source = createLocalDemoEditorWorkspaceSource({
      canvasViewerSource: createTestCanvasViewerSource(),
      dispatch: vi.fn(),
      fileViewerSource: createFileViewerSource(),
      noteDocuments: createNoteDocuments(),
      workspace,
    })
    const projectedCanvas = createDemoWorkspaceProjection(workspace).itemsById.get(
      'canvas-heist' as Id<'sidebarItems'>,
    )

    expect(source.content.currentItem.contentItem).toEqual(projectedCanvas)
    expect(source.content.currentItem.editorSearch.item).toBe(projectedCanvas?.slug)
    expect(source.index.activeItemsById.get('canvas-heist' as Id<'sidebarItems'>)).toEqual(
      projectedCanvas,
    )
  })

  it('keeps local note sessions in the note document source across editor remounts', () => {
    const sessions: Array<EditorWorkspaceNoteEditableSession> = []
    const note = createDemoWorkspaceProjection(INITIAL_DEMO_WORKSPACE).itemsById.get(
      'note-market' as Id<'sidebarItems'>,
    ) as NoteWithContent

    function Harness({ show }: { show: boolean }) {
      const noteDocuments = useLocalDemoNoteDocuments(INITIAL_DEMO_WORKSPACE)
      if (!show) return null

      if (noteDocuments.kind !== 'client') return null
      const session = noteDocuments.createEditableSession(note)
      sessions.push(session)

      return createElement('span', { 'data-testid': 'session' }, session.instanceId)
    }

    const { rerender } = render(createElement(Harness, { show: true }))
    const firstSession = sessions.at(-1)

    rerender(createElement(Harness, { show: false }))
    rerender(createElement(Harness, { show: true }))

    expect(sessions.at(-1)).toBe(firstSession)
  })
})

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

function createNoteDocuments(): EditorWorkspaceNoteDocuments {
  return { kind: 'live' }
}
