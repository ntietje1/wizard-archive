import { renderHook } from '@testing-library/react'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { Schema } from '@tiptap/pm/model'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { ParsedLinkData, ResolvedLink } from 'convex/links/types'
import type { Plugin } from '@tiptap/pm/state'
import type { LinkResolver } from '../useLinkResolver'
import { useLinkDecorations } from '../useLinkDecorations'

const { mockRegisterLinkPlugins } = vi.hoisted(() => ({
  mockRegisterLinkPlugins: vi.fn(),
}))

vi.mock('~/features/editor/utils/link-extension-utils', async () => {
  const actual = await vi.importActual<object>('~/features/editor/utils/link-extension-utils')
  return {
    ...actual,
    registerLinkPlugins: (...args: Array<unknown>) => mockRegisterLinkPlugins(...args),
  }
})

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    text: { group: 'inline' },
    paragraph: {
      group: 'block',
      content: 'text*',
      toDOM: () => ['p', 0],
    },
  },
})

function createDoc(text: string) {
  return schema.node('doc', null, [schema.node('paragraph', null, schema.text(text))])
}

function createResolver(isViewerMode: boolean): LinkResolver {
  const resolveLink = (parsed: ParsedLinkData): ResolvedLink => ({
    ...parsed,
    resolved: !parsed.itemName.toLowerCase().includes('ghost'),
    itemId: null,
    href: parsed.isExternal
      ? parsed.rawTarget
      : `/campaigns/dm/world/editor?item=${parsed.itemName.toLowerCase()}`,
    color: parsed.isExternal ? null : '#224466',
  })

  return {
    resolveLink,
    allItems: [],
    itemsMap: new Map(),
    isViewerMode,
  }
}

function getContentDecorations(plugin: Plugin, state: EditorState) {
  return plugin
    .getState(state)
    .decorations.find()
    .filter(
      (decoration: { type: { attrs?: Record<string, string> } }) =>
        decoration.type.attrs?.['data-link-role'] === 'content',
    )
}

function createEditorState(plugin: Plugin, text: string) {
  const doc = createDoc(text)
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 1),
    plugins: [plugin],
  })
}

describe('useLinkDecorations', () => {
  beforeEach(() => {
    mockRegisterLinkPlugins.mockReset()
    mockRegisterLinkPlugins.mockReturnValue(vi.fn())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('registers one combined link plugin for wiki and markdown links', () => {
    const editor = {
      _tiptapEditor: {},
    } as CustomBlockNoteEditor
    const resolver = createResolver(false)

    renderHook(() => useLinkDecorations(editor, resolver))

    expect(mockRegisterLinkPlugins).toHaveBeenCalledTimes(1)
    const options = mockRegisterLinkPlugins.mock.calls[0][0]
    expect(options.pluginKey.key).toContain('linkDecoration')
    expect(options.stabilizerKey.key).toContain('linkSelectionStabilizer')

    const plugin = options.createDecorationPlugin()
    const state = createEditorState(plugin, 'Intro [[Lore]] and [Capital](Lore/Capital)')
    const contentDecorations = getContentDecorations(plugin, state)

    expect(contentDecorations).toHaveLength(2)
    expect(contentDecorations[0].type.attrs['data-link-type']).toBe('wiki')
    expect(contentDecorations[1].type.attrs['data-link-type']).toBe('md-internal')
  })

  it('updates active and viewer state without re-registering', () => {
    const editor = {
      _tiptapEditor: {},
    } as CustomBlockNoteEditor
    const { rerender } = renderHook(
      ({ resolver, isViewerMode }: { resolver: LinkResolver; isViewerMode?: boolean }) =>
        useLinkDecorations(editor, resolver, isViewerMode),
      { initialProps: { resolver: createResolver(false), isViewerMode: false } },
    )
    const options = mockRegisterLinkPlugins.mock.calls[0][0]
    const plugin = options.createDecorationPlugin()
    const initialState = createEditorState(plugin, 'Intro [[Lore]] outro')
    const initialContent = getContentDecorations(plugin, initialState)[0]

    expect(initialContent.type.attrs['data-link-active']).toBe('false')

    const activeState = initialState.apply(
      initialState.tr.setSelection(TextSelection.create(initialState.doc, initialContent.from + 1)),
    )
    expect(getContentDecorations(plugin, activeState)[0].type.attrs['data-link-active']).toBe(
      'true',
    )

    rerender({ resolver: createResolver(true), isViewerMode: true })

    expect(mockRegisterLinkPlugins).toHaveBeenCalledTimes(1)
    const viewerState = createEditorState(plugin, 'Intro [[Lore]] outro')
    expect(getContentDecorations(plugin, viewerState)[0].type.attrs['data-link-viewer']).toBe(
      'true',
    )
  })
})
