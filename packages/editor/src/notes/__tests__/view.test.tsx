import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NoteView } from '../view'
import type { CustomBlockNoteEditor } from '../editor-schema'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { ReactNode } from 'react'
import type { NoteValueRuntimeSource } from '../value-runtime-model'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { ResourceName } from '../../workspace/resource-contract'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import {
  clearInternalNativeDrag,
  isInternalNativeDrag,
} from '@wizard-archive/ui/drag-drop/internal-native-drag'

const {
  linkDecorationsSpy,
  patchDestroySpy,
  patchSyncSpy,
  runYjsHistoryCommandSpy,
  valueRuntimeSpy,
} = vi.hoisted(() => ({
  linkDecorationsSpy: vi.fn(),
  patchDestroySpy: vi.fn(),
  patchSyncSpy: vi.fn(),
  runYjsHistoryCommandSpy: vi.fn(),
  valueRuntimeSpy: vi.fn(),
}))

vi.mock('@blocknote/shadcn', () => ({
  BlockNoteView: ({ children, editable }: { children?: ReactNode; editable: boolean }) => (
    <div
      data-editable={String(editable)}
      data-testid="blocknote-view"
      onDragStart={(event) => {
        event.dataTransfer.clearData()
        event.dataTransfer.setData('text/html', '<p>Selected editor text</p>')
        event.dataTransfer.setData('text/plain', 'Selected editor text')
      }}
    >
      {children}
    </div>
  ),
}))

vi.mock('../../rich-text/blocknote/prevent-external-drop', () => ({
  PreventExternalDrop: () => <div data-testid="prevent-external-drop" />,
}))

vi.mock('../slash-menu/slash-menu', () => ({
  SlashMenu: () => <div data-testid="slash-menu" />,
}))

vi.mock('../value-block/value-block-runtime', () => ({
  NoteValueRuntimeProvider: ({
    children,
    editable,
    source,
  }: {
    children?: ReactNode
    editable: boolean
    source: NoteValueRuntimeSource
  }) => {
    valueRuntimeSpy({ editable, source })
    return <div data-testid="value-runtime">{children}</div>
  },
}))

vi.mock('../links/use-note-link-decorations', () => ({
  useNoteLinkDecorations: (...args: Array<unknown>) => linkDecorationsSpy(...args),
}))

vi.mock('@wizard-archive/ui/theme/context', () => ({
  useResolvedTheme: () => 'light',
}))

vi.mock('../../collaboration/yjs-history-patches', () => ({
  patchYSyncAfterTypeChanged: (...args: Array<unknown>) => patchSyncSpy(...args),
  patchYUndoPluginDestroy: (...args: Array<unknown>) => patchDestroySpy(...args),
  runYjsHistoryCommand: (...args: Array<unknown>) => runYjsHistoryCommandSpy(...args),
}))

describe('NoteView', () => {
  beforeEach(() => {
    clearInternalNativeDrag()
    linkDecorationsSpy.mockReset()
    patchDestroySpy.mockReset()
    patchSyncSpy.mockReset()
    runYjsHistoryCommandSpy.mockReset()
    valueRuntimeSpy.mockReset()
  })

  it('wires editor plugins and value runtime through the real note view', () => {
    const editor = createEditor()
    const linkResolver = createLinkResolver()
    const note = createNote()
    const valueRuntimeSource = createValueRuntimeSource(note.id)

    render(
      <NoteView
        editor={editor}
        editable
        editableChrome={<div data-testid="side-menu-controller" />}
        note={note}
        linkResolver={linkResolver}
        valueRuntimeSource={valueRuntimeSource}
      />,
    )

    expect(linkDecorationsSpy).toHaveBeenCalledWith(editor, linkResolver, false)
    expect(patchDestroySpy).toHaveBeenCalledWith(editor._tiptapEditor.view)
    expect(patchSyncSpy).toHaveBeenCalledWith(editor._tiptapEditor.view)
    expect(valueRuntimeSpy).toHaveBeenCalledWith({ editable: true, source: valueRuntimeSource })
    expect(screen.getByTestId('prevent-external-drop')).toBeInTheDocument()
    expect(screen.getByTestId('side-menu-controller')).toBeInTheDocument()
    expect(screen.getByTestId('slash-menu')).toBeInTheDocument()
  })

  it('captures native undo shortcuts inside the editor surface for Yjs history', () => {
    const editor = createEditor()
    render(
      <NoteView
        editor={editor}
        editable
        linkResolver={createLinkResolver()}
        noteId={sidebarItemId('note-id')}
        valueRuntimeSource={createValueRuntimeSource(sidebarItemId('note-id'))}
      />,
    )

    fireEvent.keyDown(screen.getByTestId('blocknote-view'), {
      ctrlKey: true,
      key: 'z',
    })

    expect(runYjsHistoryCommandSpy).toHaveBeenCalledWith(editor._tiptapEditor.view, 'undo')

    runYjsHistoryCommandSpy.mockClear()
    fireEvent.keyDown(screen.getByTestId('blocknote-view'), {
      metaKey: true,
      key: 'z',
    })

    expect(runYjsHistoryCommandSpy).toHaveBeenCalledWith(editor._tiptapEditor.view, 'undo')
  })

  it('keeps the editor core surface in the fill-height layout chain', () => {
    const editor = createEditor()
    render(
      <NoteView
        editor={editor}
        editable
        linkResolver={createLinkResolver()}
        noteId={sidebarItemId('note-id')}
        valueRuntimeSource={createValueRuntimeSource(sidebarItemId('note-id'))}
      />,
    )

    expect(screen.getByTestId('blocknote-view').parentElement).toHaveClass(
      'note-editor-core-surface',
    )
  })

  it('marks the editable note body as a BlockNote external URL drop target', () => {
    const editor = createEditor()
    render(
      <NoteView
        editor={editor}
        editable
        linkResolver={createLinkResolver()}
        noteId={sidebarItemId('note-id')}
        valueRuntimeSource={createValueRuntimeSource(sidebarItemId('note-id'))}
      />,
    )

    expect(screen.getByTestId('blocknote-view').parentElement).toHaveAttribute(
      'data-blocknote-external-url-drop-target',
      'true',
    )
    expect(screen.getByTestId('blocknote-view').parentElement).not.toHaveAttribute(
      'data-blocknote-external-drop-target',
    )
  })

  it('marks the editable note body as a BlockNote external file drop target when uploads are available', () => {
    const editor = createEditor()
    render(
      <NoteView
        editor={editor}
        editable
        embedTargetOperations={{ uploadFile: vi.fn() }}
        linkResolver={createLinkResolver()}
        noteId={sidebarItemId('note-id')}
        valueRuntimeSource={createValueRuntimeSource(sidebarItemId('note-id'))}
      />,
    )

    expect(screen.getByTestId('blocknote-view').parentElement).toHaveAttribute(
      'data-blocknote-external-drop-target',
      'true',
    )
  })

  it('marks selected text drags after BlockNote writes the native payload', () => {
    render(
      <NoteView
        editor={createEditor()}
        editable
        linkResolver={createLinkResolver()}
        noteId={sidebarItemId('note-id')}
        valueRuntimeSource={createValueRuntimeSource(sidebarItemId('note-id'))}
      />,
    )
    const dataTransfer = createDataTransfer()

    fireEvent.dragStart(screen.getByTestId('blocknote-view'), { dataTransfer })
    clearInternalNativeDrag()

    expect(dataTransfer.getData('text/plain')).toBe('Selected editor text')
    expect(isInternalNativeDrag(dataTransfer)).toBe(true)
  })
})

function createDataTransfer(): DataTransfer {
  const data = new Map<string, string>()
  return {
    clearData: () => data.clear(),
    getData: (type: string) => data.get(type) ?? '',
    setData: (type: string, value: string) => {
      data.set(type, value)
    },
    get types() {
      return [...data.keys()]
    },
  } as unknown as DataTransfer
}

function createEditor(): CustomBlockNoteEditor {
  return {
    _tiptapEditor: {
      view: {
        dom: document.createElement('div'),
        hasFocus: () => true,
      },
    },
  } as unknown as CustomBlockNoteEditor
}

function createLinkResolver() {
  return {
    revision: 'test',
    isViewerMode: false,
    resolveLink: vi.fn(),
  }
}

function createNote(overrides: Partial<NoteItemWithContent> = {}): NoteItemWithContent {
  return {
    id: sidebarItemId('note-id'),
    name: 'Note' as ResourceName,
    type: RESOURCE_TYPES.notes,
    ancestors: [],
    content: [],
    ...overrides,
  } as unknown as NoteItemWithContent
}

function sidebarItemId(value: string): SidebarItemId {
  return value as SidebarItemId
}

function createValueRuntimeSource(noteId: NoteItemWithContent['id']): NoteValueRuntimeSource {
  return {
    noteId,
    authoredDefinitions: [],
    persistedStates: [],
    externalDependencyStates: [],
    externalDependencyStatesStatus: 'success',
    referenceableStates: [],
    referenceableStatesStatus: 'success',
    references: {
      getNoteCandidates: () => [],
      resolveNoteIdByPath: () => null,
    },
  }
}
