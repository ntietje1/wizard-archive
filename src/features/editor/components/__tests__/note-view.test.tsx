import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteView } from '../note-view'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { LinkResolver } from '~/features/editor/hooks/useLinkResolver'

const mockPatchYSyncAfterTypeChanged = vi.hoisted(() => vi.fn())
const mockPatchYUndoPluginDestroy = vi.hoisted(() => vi.fn())

vi.mock('@blocknote/shadcn', () => ({
  BlockNoteView: ({
    children,
    editor,
    className,
    style,
  }: React.HTMLAttributes<HTMLDivElement> & {
    children?: React.ReactNode
    editor: CustomBlockNoteEditor
  }) => (
    <div className={className} data-testid="block-note-view" style={style}>
      <div
        data-testid="block-note-editable"
        ref={(node) => {
          const dom = editor._tiptapEditor.view.dom
          if (node && !node.contains(dom)) node.append(dom)
        }}
      />
      {children}
    </div>
  ),
}))

vi.mock('@blocknote/react', () => ({
  SideMenuController: () => null,
}))

vi.mock('../extensions/prevent-external-drop/prevent-external-drop', () => ({
  PreventExternalDrop: () => null,
}))

vi.mock('../extensions/side-menu/side-menu', () => ({
  SideMenuRenderer: () => null,
}))

vi.mock('../extensions/slash-menu/slash-menu', () => ({
  SlashMenu: () => null,
}))

vi.mock('~/features/editor/hooks/useWikiLinkExtension', () => ({
  useWikiLinkExtension: vi.fn(),
}))

vi.mock('~/features/editor/hooks/useMdLinkExtension', () => ({
  useMdLinkExtension: vi.fn(),
}))

vi.mock('~/features/editor/hooks/useDisableAutolink', () => ({
  useDisableAutolink: vi.fn(),
}))

vi.mock('~/features/settings/hooks/useTheme', () => ({
  useResolvedTheme: () => 'light',
}))

vi.mock('~/features/editor/utils/patch-yundo-destroy', () => ({
  patchYSyncAfterTypeChanged: mockPatchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy: mockPatchYUndoPluginDestroy,
}))

describe('NoteView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('patches collaborative Yjs undo on the mounted editor view', () => {
    const { editor, view } = createEditor()

    render(<NoteView editor={editor} editable linkResolver={createLinkResolver()} />)

    expect(mockPatchYUndoPluginDestroy).toHaveBeenCalledWith(view)
    expect(mockPatchYSyncAfterTypeChanged).toHaveBeenCalledWith(view)
  })
})

function createEditor() {
  const dom = document.createElement('div')
  const view = {
    dom,
    hasFocus: vi.fn(() => false),
  }
  const editor = {
    document: [createBlock('current')],
    replaceBlocks: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    _tiptapEditor: {
      view,
    },
  } as unknown as CustomBlockNoteEditor

  return {
    editor,
    dom,
    view,
  }
}

function createBlock(id: string) {
  return {
    id,
    type: 'paragraph',
    props: {},
    content: [],
    children: [],
  } as unknown as CustomBlockNoteEditor['document'][number]
}

function createLinkResolver(): LinkResolver {
  return {
    isViewerMode: false,
    resolveLink: vi.fn(),
    allItems: [],
    itemsMap: new Map(),
  }
}
