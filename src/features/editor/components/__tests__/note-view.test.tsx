import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteView } from '../note-view'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { NoteWithContent } from 'shared/notes/types'
import type { ReactNode } from 'react'
import type { NoteValueRuntimeSource } from '~/features/editor/value-block/note-value-runtime-source'
import { testId } from '~/test/helpers/test-id'

const {
  disableAutolinkSpy,
  linkDecorationsSpy,
  patchDestroySpy,
  patchSyncSpy,
  runYjsHistoryCommandSpy,
  valueRuntimeSpy,
} = vi.hoisted(() => ({
  disableAutolinkSpy: vi.fn(),
  linkDecorationsSpy: vi.fn(),
  patchDestroySpy: vi.fn(),
  patchSyncSpy: vi.fn(),
  runYjsHistoryCommandSpy: vi.fn(),
  valueRuntimeSpy: vi.fn(),
}))

vi.mock('@blocknote/shadcn', () => ({
  BlockNoteView: ({ children, editable }: { children?: ReactNode; editable: boolean }) => (
    <div data-editable={String(editable)} data-testid="blocknote-view">
      {children}
    </div>
  ),
}))

vi.mock('@blocknote/react', () => ({
  SideMenuController: () => <div data-testid="side-menu-controller" />,
}))

vi.mock('../extensions/prevent-external-drop/prevent-external-drop', () => ({
  PreventExternalDrop: () => <div data-testid="prevent-external-drop" />,
}))

vi.mock('../extensions/side-menu/side-menu', () => ({
  SideMenuRenderer: () => null,
}))

vi.mock('../extensions/slash-menu/slash-menu', () => ({
  SlashMenu: () => <div data-testid="slash-menu" />,
}))

vi.mock('../../value-block/value-block-runtime', () => ({
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

vi.mock('~/features/editor/hooks/useDisableAutolink', () => ({
  useDisableAutolink: (...args: Array<unknown>) => disableAutolinkSpy(...args),
}))

vi.mock('~/features/editor/hooks/useLinkDecorations', () => ({
  useLinkDecorations: (...args: Array<unknown>) => linkDecorationsSpy(...args),
}))

vi.mock('~/shared/theme/context', () => ({
  useResolvedTheme: () => 'light',
}))

vi.mock('~/features/editor/utils/patch-yundo-destroy', () => ({
  patchYSyncAfterTypeChanged: (...args: Array<unknown>) => patchSyncSpy(...args),
  patchYUndoPluginDestroy: (...args: Array<unknown>) => patchDestroySpy(...args),
  runYjsHistoryCommand: (...args: Array<unknown>) => runYjsHistoryCommandSpy(...args),
}))

describe('NoteView', () => {
  beforeEach(() => {
    disableAutolinkSpy.mockReset()
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
    const valueRuntimeSource = createValueRuntimeSource(note._id)

    render(
      <NoteView
        editor={editor}
        editable
        note={note}
        linkResolver={linkResolver}
        valueRuntimeSource={valueRuntimeSource}
      />,
    )

    expect(linkDecorationsSpy).toHaveBeenCalledWith(editor, linkResolver, false)
    expect(disableAutolinkSpy).toHaveBeenCalledWith(editor)
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
        noteId={testId<'sidebarItems'>('note-id')}
        valueRuntimeSource={createValueRuntimeSource(testId<'sidebarItems'>('note-id'))}
      />,
    )

    const event = fireEvent.keyDown(screen.getByTestId('blocknote-view'), {
      ctrlKey: true,
      key: 'z',
    })

    expect(event).toBe(false)
    expect(runYjsHistoryCommandSpy).toHaveBeenCalledWith(editor._tiptapEditor.view, 'undo')

    runYjsHistoryCommandSpy.mockClear()
    const metaEvent = fireEvent.keyDown(screen.getByTestId('blocknote-view'), {
      metaKey: true,
      key: 'z',
    })

    expect(metaEvent).toBe(false)
    expect(runYjsHistoryCommandSpy).toHaveBeenCalledWith(editor._tiptapEditor.view, 'undo')
  })

  it('does not run a second history command after the editor keymap handles the shortcut', () => {
    const editor = createEditor()
    render(
      <NoteView
        editor={editor}
        editable
        linkResolver={createLinkResolver()}
        noteId={testId<'sidebarItems'>('note-id')}
        valueRuntimeSource={createValueRuntimeSource(testId<'sidebarItems'>('note-id'))}
      >
        <input aria-label="editor child" />
      </NoteView>,
    )
    screen.getByLabelText('editor child').addEventListener('keydown', (event) => {
      event.preventDefault()
    })

    fireEvent.keyDown(screen.getByLabelText('editor child'), {
      ctrlKey: true,
      key: 'y',
    })

    expect(runYjsHistoryCommandSpy).not.toHaveBeenCalled()
  })
})

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
    allItems: [],
    isViewerMode: false,
    itemsMap: new Map(),
    resolveLink: vi.fn(),
  }
}

function createNote(): NoteWithContent {
  return {
    _id: testId<'sidebarItems'>('note-id'),
    content: [],
  } as unknown as NoteWithContent
}

function createValueRuntimeSource(noteId: NoteWithContent['_id']): NoteValueRuntimeSource {
  return {
    noteId,
    authoredDefinitions: [],
    externalNoteIdByPath: new Map(),
    externalStates: [],
    itemsMap: new Map(),
    persistedStates: [],
    sidebarItems: [],
  }
}
