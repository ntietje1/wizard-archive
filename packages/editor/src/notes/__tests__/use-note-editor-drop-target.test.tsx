import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ReactNode } from 'react'
import { DndProviderContext } from '../../drag-drop/context'
import { NOTE_EDITOR_DROP_TYPE } from '../../drag-drop/drop-target-data'
import { executePlannedDropCommand } from '../../drag-drop/drop-command-execution'
import { executeRegisteredSurfaceDropCommand } from '../../drag-drop/surface-command'
import { DEFAULT_NOTE_EMBED_PREVIEW_WIDTH } from '../embeds/block-targets'
import { useNoteEditorDropTarget } from '../use-note-editor-drop-target'
import type { AnyItem } from '../../workspace/items'
import type { DndValue } from '../../drag-drop/context'
import type { CustomBlockNoteEditor } from '../editor-schema'
import type { SidebarItemId } from '../../../../../shared/common/ids'

const dropTargetCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>)
const externalDropTargetState = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  ref: vi.fn(),
}))
const externalUrlDropTargetState = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  ref: vi.fn(),
}))

vi.mock('../../drag-drop/use-drop-target', () => ({
  useDndDropTarget: (options: Record<string, unknown>) => {
    dropTargetCalls.push(options)
    return { dropTargetRef: vi.fn(), dropTargetKey: 'note:target-note', isDropTarget: false }
  },
}))
vi.mock('../../drag-drop/use-external-drop-target', () => ({
  useExternalDropTarget: (options: Record<string, unknown>) => {
    externalDropTargetState.calls.push(options)
    return { externalDropTargetRef: externalDropTargetState.ref, isFileDropTarget: false }
  },
}))
vi.mock('../../drag-drop/use-external-url-drop-target', () => ({
  useExternalUrlDropTarget: (options: Record<string, unknown>) => {
    externalUrlDropTargetState.calls.push(options)
    return { externalUrlDropTargetRef: externalUrlDropTargetState.ref, isUrlDropTarget: false }
  },
}))

describe('useNoteEditorDropTarget', () => {
  afterEach(() => {
    dropTargetCalls.length = 0
    externalDropTargetState.calls.length = 0
    externalDropTargetState.ref.mockClear()
    externalUrlDropTargetState.calls.length = 0
    externalUrlDropTargetState.ref.mockClear()
  })

  it('registers the editable note body as a note editor drop target', () => {
    const editor = createEditor()

    renderHook(
      () =>
        useNoteEditorDropTarget({
          editor,
          enabled: true,
          sourceNoteId: noteId('target-note'),
        }),
      { wrapper: createDndWrapper() },
    )

    expect(dropTargetCalls).toContainEqual(
      expect.objectContaining({
        canDrop: true,
        data: {
          __wizardArchiveDndRuntimeId: 'runtime-1',
          type: NOTE_EDITOR_DROP_TYPE,
          noteId: 'target-note',
        },
      }),
    )
  })

  it('inserts dropped sidebar items as wiki links at the drop point', async () => {
    const editor = createEditor()
    const droppedItem = createItem('map-1', 'Clock Tower')
    const effects = {
      reportError: vi.fn(),
      reportRejection: vi.fn(),
      reportRejections: vi.fn(),
    }
    const setBatchDecision = vi.fn()
    const { unmount } = renderHook(
      () =>
        useNoteEditorDropTarget({
          editor,
          enabled: true,
          sourceNoteId: noteId('target-note'),
        }),
      { wrapper: createDndWrapper() },
    )

    await waitFor(() =>
      expect(
        executeRegisteredSurfaceDropCommand({
          command: {
            action: 'link',
            commandId: 'surface-drop.link-sidebar-item-in-note',
            items: [droppedItem],
            label: 'Add link here',
            rejectedItems: [],
            status: 'ready',
            target: {
              __wizardArchiveDndRuntimeId: 'runtime-1',
              type: NOTE_EDITOR_DROP_TYPE,
              noteId: noteId('target-note'),
            },
          },
          effects,
          input: { clientX: 10, clientY: 20 },
          setBatchDecision,
        }),
      ).resolves.toBeUndefined(),
    )

    expect(editor._tiptapEditor.view.posAtCoords).toHaveBeenCalledWith({ left: 10, top: 20 })
    expect(editor._tiptapEditor.setTextSelection).toHaveBeenCalledWith({ from: 42, to: 42 })
    expect(editor._tiptapEditor.insertContent).toHaveBeenCalledWith('[[Places/Clock Tower]]')
    expect(setBatchDecision).not.toHaveBeenCalled()

    unmount()
  })

  it('inserts external URL drops as note embed blocks at the drop point', async () => {
    const editor = createEditor()
    const { unmount } = renderHook(
      () =>
        useNoteEditorDropTarget({
          editor,
          enabled: true,
          sourceNoteId: noteId('target-note'),
        }),
      { wrapper: createDndWrapper() },
    )

    await executePlannedDropCommand(
      {
        kind: 'surfaceExternalUrl',
        commandId: 'surface-url-drop.note-editor',
        target: {
          __wizardArchiveDndRuntimeId: 'runtime-1',
          type: NOTE_EDITOR_DROP_TYPE,
          noteId: noteId('target-note'),
        },
        embedTarget: {
          kind: 'externalUrl',
          url: 'https://example.com/file.pdf',
          name: 'file.pdf',
        },
        label: 'Add URL embed to note',
      },
      { clientX: 10, clientY: 20 },
      createDropExecutionContext(),
    )

    expect(editor._tiptapEditor.view.posAtCoords).toHaveBeenCalledWith({ left: 10, top: 20 })
    expect(editor.insertBlocks).toHaveBeenCalledWith(
      [
        {
          type: 'embed',
          props: {
            targetKind: 'externalUrl',
            url: 'https://example.com/file.pdf',
            name: 'file.pdf',
            previewWidth: DEFAULT_NOTE_EMBED_PREVIEW_WIDTH,
          },
        },
      ],
      { id: 'current-block' },
      'after',
    )

    unmount()
  })

  it('inserts empty embed blocks before resolving external file uploads', async () => {
    const editor = createEditor()
    const upload = createDeferred<{
      status: 'completed'
      itemId: SidebarItemId
    }>()
    const uploadFile = vi.fn(() => upload.promise)
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const { unmount } = renderHook(
      () =>
        useNoteEditorDropTarget({
          editor,
          enabled: true,
          sourceNoteId: noteId('target-note'),
          uploadFile,
        }),
      { wrapper: createDndWrapper() },
    )

    const execution = executePlannedDropCommand(
      {
        kind: 'surfaceFileImport',
        commandId: 'surface-file-import.note-editor',
        target: {
          __wizardArchiveDndRuntimeId: 'runtime-1',
          type: NOTE_EDITOR_DROP_TYPE,
          noteId: noteId('target-note'),
        },
        dropResult: { files: [{ file, relativePath: file.name }], rootFolders: [] },
        label: 'Add file embeds to note',
      },
      { clientX: 10, clientY: 20 },
      createDropExecutionContext(),
    )

    expect(uploadFile).toHaveBeenCalledWith(file)
    expect(editor.insertBlocks).toHaveBeenCalledWith(
      [
        {
          type: 'embed',
          props: {
            targetKind: 'empty',
            previewWidth: DEFAULT_NOTE_EMBED_PREVIEW_WIDTH,
          },
        },
      ],
      { id: 'current-block' },
      'after',
    )
    expect(editor.updateBlock).not.toHaveBeenCalled()

    upload.resolve({ status: 'completed', itemId: noteId('uploaded-file') })
    await execution

    expect(editor.updateBlock).toHaveBeenCalledWith(
      { id: 'inserted-block-1' },
      {
        props: {
          targetKind: 'resource',
          resourceId: noteId('uploaded-file'),
        },
      },
    )
    expect(editor.updateBlock.mock.contexts[0]).toBe(editor)

    unmount()
  })

  it('keeps successful file embeds when another dropped upload fails', async () => {
    const editor = createEditor()
    const uploadError = new Error('second upload failed')
    const uploadFile = vi
      .fn()
      .mockResolvedValueOnce({ status: 'completed', itemId: noteId('uploaded-file') })
      .mockRejectedValueOnce(uploadError)
    const firstFile = new File(['first'], 'first.png', { type: 'image/png' })
    const secondFile = new File(['second'], 'second.png', { type: 'image/png' })
    const { unmount } = renderHook(
      () =>
        useNoteEditorDropTarget({
          editor,
          enabled: true,
          sourceNoteId: noteId('target-note'),
          uploadFile,
        }),
      { wrapper: createDndWrapper() },
    )

    await expect(
      executePlannedDropCommand(
        {
          kind: 'surfaceFileImport',
          commandId: 'surface-file-import.note-editor',
          target: {
            __wizardArchiveDndRuntimeId: 'runtime-1',
            type: NOTE_EDITOR_DROP_TYPE,
            noteId: noteId('target-note'),
          },
          dropResult: {
            files: [firstFile, secondFile].map((file) => ({ file, relativePath: file.name })),
            rootFolders: [],
          },
          label: 'Add file embeds to note',
        },
        { clientX: 10, clientY: 20 },
        createDropExecutionContext(),
      ),
    ).resolves.toBeUndefined()

    expect(uploadFile).toHaveBeenCalledTimes(2)
    expect(editor.updateBlock).toHaveBeenCalledExactlyOnceWith(
      { id: 'inserted-block-1' },
      {
        props: {
          targetKind: 'resource',
          resourceId: noteId('uploaded-file'),
        },
      },
    )

    unmount()
  })

  it('returns a merged ref and registers native external note-body targets', () => {
    const editor = createEditor()
    const uploadFile = vi.fn()
    const { result } = renderHook(
      () =>
        useNoteEditorDropTarget({
          editor,
          enabled: true,
          sourceNoteId: noteId('target-note'),
          uploadFile,
        }),
      { wrapper: createDndWrapper({ canAcceptExternalFiles: true }) },
    )
    const node = document.createElement('div')

    result.current.dropTargetRef(node)

    expect(externalDropTargetState.ref).toHaveBeenCalledWith(node)
    expect(externalUrlDropTargetState.ref).toHaveBeenCalledWith(node)
    expect(externalDropTargetState.calls).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          __wizardArchiveDndRuntimeId: 'runtime-1',
          type: NOTE_EDITOR_DROP_TYPE,
          noteId: 'target-note',
        }),
        enabled: true,
        blockedTargetSelector: '[data-blocknote-external-drop-blocked="true"]',
        fileDropTarget: {
          kind: 'accepted',
          files: {
            kind: 'surfaceFileImport',
            commandId: 'surface-file-import.note-editor',
            label: 'Add file embeds to note',
          },
          browserFolders: {
            kind: 'fileImport',
            destination: { kind: 'assets' },
          },
        },
      }),
    )
    expect(externalUrlDropTargetState.calls).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          __wizardArchiveDndRuntimeId: 'runtime-1',
          type: NOTE_EDITOR_DROP_TYPE,
          noteId: 'target-note',
        }),
        enabled: true,
        blockedTargetSelector: '[data-blocknote-external-drop-blocked="true"]',
      }),
    )
  })
})

function createDndWrapper({ canAcceptExternalFiles = false } = {}) {
  const value: DndValue = {
    canAcceptExternalFiles,
    dispatchDropPayload: () => Promise.resolve(),
    getItemLinkPath: (item) => ['Places', item.name],
    runtimeId: 'runtime-1',
  }

  return function DndWrapper({ children }: { children: ReactNode }) {
    return <DndProviderContext.Provider value={value}>{children}</DndProviderContext.Provider>
  }
}

function createEditor() {
  const chain = {
    focus: vi.fn(() => chain),
    insertContent: vi.fn(() => chain),
    run: vi.fn(() => true),
    setTextSelection: vi.fn(() => chain),
  }
  let insertedBlockSequence = 0
  return {
    _tiptapEditor: {
      chain: vi.fn(() => chain),
      focus: chain.focus,
      insertContent: chain.insertContent,
      run: chain.run,
      setTextSelection: chain.setTextSelection,
      view: {
        posAtCoords: vi.fn(() => ({ pos: 42 })),
      },
    },
    getTextCursorPosition: vi.fn(() => ({ block: { id: 'current-block' } })),
    insertBlocks: vi.fn((blocks: Array<unknown>) =>
      blocks.map(() => ({ id: `inserted-block-${++insertedBlockSequence}` })),
    ),
    updateBlock: vi.fn(),
  } as unknown as CustomBlockNoteEditor & {
    _tiptapEditor: typeof chain & { view: { posAtCoords: ReturnType<typeof vi.fn> } }
    getTextCursorPosition: ReturnType<typeof vi.fn>
    insertBlocks: ReturnType<typeof vi.fn>
    updateBlock: ReturnType<typeof vi.fn>
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

function createDropExecutionContext() {
  return {
    executeFileSystemCommand: vi.fn(),
    handleDropFiles: vi.fn(),
    openItem: vi.fn(),
    setBatchDecision: vi.fn(),
  }
}

function createItem(id: string, name: string): AnyItem {
  return {
    campaignId: 'campaign-1',
    id,
    name,
    parentId: null,
    status: 'active',
    type: 'gameMaps',
  } as unknown as AnyItem
}

function noteId(value: string): SidebarItemId {
  return value as SidebarItemId
}
