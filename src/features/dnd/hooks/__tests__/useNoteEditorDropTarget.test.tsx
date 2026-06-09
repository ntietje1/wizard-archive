import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { DropResult } from '~/features/file-upload/utils/folder-reader'
import type { ConvexYjsProvider } from '~/shared/collaboration/convex-yjs-provider'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'
import { NOTE_EDITOR_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import { executeRegisteredSurfaceDropCommand } from '~/features/dnd/utils/surface-drop-command'
import { resolveSurfaceDropCommand } from '~/features/dnd/utils/surface-drop-planner'
import { executeRegisteredExternalFileDropCommand } from '~/features/dnd/utils/external-file-drop-command'
import { focusEditorViewAtNearestPoint } from '~/features/editor/utils/note-editor-focus'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import { useNoteEditorDropTarget } from '../useNoteEditorDropTarget'

const uploadEmbedFile = vi.hoisted(() => vi.fn())
const activeSidebarItems = vi.hoisted(() => ({
  data: [] as Array<AnySidebarItem>,
  itemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
}))

vi.mock('~/features/dnd/hooks/useDndDropTarget', () => ({
  useDndDropTarget: vi.fn(() => ({ isDropTarget: false })),
}))

vi.mock('~/features/dnd/hooks/useExternalDropTarget', () => ({
  useExternalDropTarget: vi.fn(() => ({ isFileDropTarget: false })),
}))

vi.mock('~/features/embeds/hooks/use-embed-upload', () => ({
  useEmbedUpload: () => ({
    uploadEmbedFile,
  }),
}))

vi.mock('~/features/editor/utils/note-editor-focus', () => ({
  focusEditorViewAtNearestPoint: vi.fn(),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => activeSidebarItems,
}))

function createEditor() {
  const referenceBlock = { id: 'block-1' }
  const beforeBlock = { id: 'block-0' }
  const editorElement = document.createElement('div')
  const insertBlocks = vi.fn()
  const flushUpdates = vi.fn(() => Promise.resolve())
  const editor = {
    document: [beforeBlock, referenceBlock],
    getBlock: vi.fn((id: string) => {
      if (id === beforeBlock.id) return beforeBlock
      if (id === referenceBlock.id) return referenceBlock
      return undefined
    }),
    getTextCursorPosition: vi.fn(() => ({ block: referenceBlock })),
    insertBlocks,
    _tiptapEditor: {
      view: {
        dom: editorElement,
        posAtCoords: vi.fn(() => ({ pos: 1 })),
      },
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          insertContentAt: vi.fn(() => ({
            run: vi.fn(),
          })),
        })),
      })),
    },
  } as unknown as CustomBlockNoteEditor
  const provider = {
    flushUpdates,
  } as unknown as ConvexYjsProvider
  return {
    beforeBlock,
    editor,
    provider,
    referenceBlock,
    insertBlocks,
    flushUpdates,
    editorView: editor._tiptapEditor.view,
  }
}

function createBlockContainer(
  parent: HTMLElement,
  id: string,
  { top, bottom }: { top: number; bottom: number },
) {
  const element = document.createElement('div')
  element.setAttribute('data-node-type', 'blockContainer')
  element.setAttribute('data-id', id)
  element.getBoundingClientRect = vi.fn(() => ({
    bottom,
    height: bottom - top,
    left: 100,
    right: 500,
    top,
    width: 400,
    x: 100,
    y: top,
    toJSON: () => ({}),
  }))
  parent.append(element)
  return element
}

function mountHook(noteId: Id<'sidebarItems'>) {
  const element = document.createElement('div')
  return renderHook(() =>
    useNoteEditorDropTarget({
      ref: { current: element },
      noteId,
    }),
  )
}

describe('useNoteEditorDropTarget', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    uploadEmbedFile.mockReset()
    vi.mocked(focusEditorViewAtNearestPoint).mockReset()
    activeSidebarItems.data = []
    activeSidebarItems.itemsMap = new Map()
    useNoteEditorStore.setState({ editor: null, provider: null })
  })

  it('inserts sidebar item embed blocks for shift-drops into note editors', async () => {
    const noteId = testId<'sidebarItems'>('note_target')
    const dragged = createNote()
    activeSidebarItems.data = [dragged]
    activeSidebarItems.itemsMap = new Map([[dragged._id, dragged]])
    const { editor, provider, referenceBlock, insertBlocks, flushUpdates } = createEditor()
    useNoteEditorStore.getState().claimEditor(editor, provider)

    mountHook(noteId)

    const command = resolveSurfaceDropCommand(
      [dragged],
      { type: NOTE_EDITOR_DROP_TYPE, noteId },
      { campaignId: dragged.campaignId },
      { noteEditorDropAction: 'embed' },
    )

    await act(async () => {
      await executeRegisteredSurfaceDropCommand({
        command,
        input: { clientX: 10, clientY: 20 },
        setBatchDecision: vi.fn(),
      })
    })

    expect(insertBlocks).toHaveBeenCalledWith(
      [
        {
          type: 'embed',
          props: {
            previewWidth: 480,
            targetKind: 'sidebarItem',
            sidebarItemId: dragged._id,
          },
        },
      ],
      referenceBlock,
      'after',
    )
    expect(focusEditorViewAtNearestPoint).toHaveBeenCalledWith(editor._tiptapEditor.view, {
      x: 10,
      y: 20,
    })
    expect(flushUpdates).toHaveBeenCalled()
  })

  it('snaps shift-dropped sidebar item embeds to the nearest block insertion boundary', async () => {
    const noteId = testId<'sidebarItems'>('note_target')
    const dragged = createNote()
    activeSidebarItems.data = [dragged]
    activeSidebarItems.itemsMap = new Map([[dragged._id, dragged]])
    const { editor, provider, referenceBlock, insertBlocks } = createEditor()
    const blockElement = createBlockContainer(editor._tiptapEditor.view.dom, referenceBlock.id, {
      top: 100,
      bottom: 160,
    })
    const child = document.createElement('span')
    blockElement.append(child)
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(),
    })
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(child)
    useNoteEditorStore.getState().claimEditor(editor, provider)

    mountHook(noteId)

    const command = resolveSurfaceDropCommand(
      [dragged],
      { type: NOTE_EDITOR_DROP_TYPE, noteId },
      { campaignId: dragged.campaignId },
      { noteEditorDropAction: 'embed' },
    )

    await act(async () => {
      await executeRegisteredSurfaceDropCommand({
        command,
        input: { clientX: 300, clientY: 104 },
        setBatchDecision: vi.fn(),
      })
    })

    expect(insertBlocks).toHaveBeenCalledWith(
      [
        {
          type: 'embed',
          props: {
            previewWidth: 480,
            targetKind: 'sidebarItem',
            sidebarItemId: dragged._id,
          },
        },
      ],
      referenceBlock,
      'before',
    )
  })

  it('uploads external files and inserts embeds for the created sidebar items', async () => {
    const noteId = testId<'sidebarItems'>('note_target')
    const uploadedId = testId<'sidebarItems'>('uploaded_file')
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    uploadEmbedFile.mockResolvedValue({ id: uploadedId, slug: 'portrait' })
    const { editor, provider, referenceBlock, insertBlocks, flushUpdates } = createEditor()
    useNoteEditorStore.getState().claimEditor(editor, provider)

    mountHook(noteId)

    let outcome
    await act(async () => {
      outcome = await executeRegisteredExternalFileDropCommand({
        target: { type: NOTE_EDITOR_DROP_TYPE, noteId },
        dropResult,
        input: { clientX: 10, clientY: 20 },
      })
    })

    expect(uploadEmbedFile).toHaveBeenCalledWith(file)
    expect(insertBlocks).toHaveBeenCalledWith(
      [
        {
          type: 'embed',
          props: {
            previewWidth: 480,
            targetKind: 'sidebarItem',
            sidebarItemId: uploadedId,
          },
        },
      ],
      referenceBlock,
      'after',
    )
    expect(flushUpdates).toHaveBeenCalled()
    expect(outcome).toEqual({ handled: true, unhandledDropResult: undefined })
  })

  it('focuses the editor at the drop point after inserting external file embeds', async () => {
    const noteId = testId<'sidebarItems'>('note_target')
    const uploadedId = testId<'sidebarItems'>('uploaded_file')
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    uploadEmbedFile.mockResolvedValue({ id: uploadedId, slug: 'portrait' })
    const { editor, provider, editorView } = createEditor()
    useNoteEditorStore.getState().claimEditor(editor, provider)

    mountHook(noteId)

    await act(async () => {
      await executeRegisteredExternalFileDropCommand({
        target: { type: NOTE_EDITOR_DROP_TYPE, noteId },
        dropResult,
        input: { clientX: 10, clientY: 20 },
      })
    })

    expect(focusEditorViewAtNearestPoint).toHaveBeenCalledWith(editorView, { x: 10, y: 20 })
  })
})
