import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBlockNotePlugins } from '../use-blocknote-plugins'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { LinkResolver } from '~/features/editor/hooks/useLinkResolver'

const mockPatchYSyncAfterTypeChanged = vi.hoisted(() => vi.fn())
const mockPatchYUndoPluginDestroy = vi.hoisted(() => vi.fn())
const mockUseWikiLinkExtension = vi.hoisted(() => vi.fn())
const mockUseMdLinkExtension = vi.hoisted(() => vi.fn())
const mockUseDisableAutolink = vi.hoisted(() => vi.fn())

vi.mock('~/features/editor/hooks/useWikiLinkExtension', () => ({
  useWikiLinkExtension: mockUseWikiLinkExtension,
}))

vi.mock('~/features/editor/hooks/useMdLinkExtension', () => ({
  useMdLinkExtension: mockUseMdLinkExtension,
}))

vi.mock('~/features/editor/hooks/useDisableAutolink', () => ({
  useDisableAutolink: mockUseDisableAutolink,
}))

vi.mock('~/features/editor/utils/patch-yundo-destroy', () => ({
  patchYSyncAfterTypeChanged: mockPatchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy: mockPatchYUndoPluginDestroy,
  runYjsHistoryCommand: vi.fn(),
}))

describe('useBlockNotePlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets up editor plugins and collaborative undo patches through one hook', () => {
    const { editor, view } = createEditor()
    const resolver = createLinkResolver()

    renderHook(() => useBlockNotePlugins({ editor, editable: true, linkResolver: resolver }))

    expect(mockUseWikiLinkExtension).toHaveBeenCalledWith(editor, resolver, false)
    expect(mockUseMdLinkExtension).toHaveBeenCalledWith(editor, resolver, false)
    expect(mockUseDisableAutolink).toHaveBeenCalledWith(editor)
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
