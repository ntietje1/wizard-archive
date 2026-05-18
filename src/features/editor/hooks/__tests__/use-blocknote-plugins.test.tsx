import { render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBlockNotePlugins } from '../use-blocknote-plugins'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { LinkResolver } from '~/features/editor/hooks/useLinkResolver'

const mockPatchYSyncAfterTypeChanged = vi.hoisted(() => vi.fn())
const mockPatchYUndoPluginDestroy = vi.hoisted(() => vi.fn())
const mockUseLinkDecorations = vi.hoisted(() => vi.fn())
const mockUseDisableAutolink = vi.hoisted(() => vi.fn())

vi.mock('~/features/editor/hooks/useLinkDecorations', () => ({
  useLinkDecorations: mockUseLinkDecorations,
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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets up editor plugins and collaborative undo patches through one hook', () => {
    const { editor, view } = createEditor()
    const resolver = createLinkResolver()

    renderHook(() => useBlockNotePlugins({ editor, editable: true, linkResolver: resolver }))

    expect(mockUseLinkDecorations).toHaveBeenCalledWith(editor, resolver, false)
    expect(mockUseDisableAutolink).toHaveBeenCalledWith(editor)
    expect(mockPatchYUndoPluginDestroy).toHaveBeenCalledWith(view)
    expect(mockPatchYSyncAfterTypeChanged).toHaveBeenCalledWith(view)
  })

  it('uses viewer link mode for non-editable editors while keeping passive plugins active', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const { editor, view } = createEditor()
    const resolver = createLinkResolver()

    renderPluginSurface({ editor, editable: false, linkResolver: resolver })

    expectViewerPluginSetup({ editor, resolver, view, addEventListenerSpy })
  })

  it('uses viewer link mode and skips shortcut registration when the resolver is in viewer mode', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const { editor, view } = createEditor()
    const resolver = createLinkResolver({ isViewerMode: true })

    renderPluginSurface({ editor, editable: true, linkResolver: resolver })

    expectViewerPluginSetup({ editor, resolver, view, addEventListenerSpy })
  })
})

function expectViewerPluginSetup({
  editor,
  resolver,
  view,
  addEventListenerSpy,
}: {
  editor: CustomBlockNoteEditor
  resolver: LinkResolver
  view: unknown
  addEventListenerSpy: ReturnType<typeof vi.spyOn>
}) {
  expect(mockUseLinkDecorations).toHaveBeenCalledWith(editor, resolver, true)
  expect(mockUseDisableAutolink).toHaveBeenCalledWith(editor)
  expect(mockPatchYUndoPluginDestroy).toHaveBeenCalledWith(view)
  expect(mockPatchYSyncAfterTypeChanged).toHaveBeenCalledWith(view)
  expect(addEventListenerSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function), {
    capture: true,
  })
}

function renderPluginSurface({
  editor,
  editable,
  linkResolver,
}: {
  editor: CustomBlockNoteEditor
  editable: boolean
  linkResolver: LinkResolver
}) {
  function PluginSurface() {
    const surfaceRef = useBlockNotePlugins({ editor, editable, linkResolver })
    return <div ref={surfaceRef} />
  }

  return render(<PluginSurface />)
}

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

function createLinkResolver(overrides: Partial<LinkResolver> = {}): LinkResolver {
  return {
    isViewerMode: false,
    resolveLink: vi.fn(),
    allItems: [],
    itemsMap: new Map(),
    ...overrides,
  }
}
