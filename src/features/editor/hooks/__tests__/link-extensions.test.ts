import { renderHook } from '@testing-library/react'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { Schema } from '@tiptap/pm/model'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { ParsedLinkData, ResolvedLink } from 'convex/links/types'
import type { Plugin } from '@tiptap/pm/state'
import type { LinkResolver } from '../useLinkResolver'
import { useMdLinkExtension } from '../useMdLinkExtension'
import { useWikiLinkExtension } from '../useWikiLinkExtension'

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

function getContentDecoration(state: EditorState) {
  const decoration = state.plugins[0]
    ?.getState(state)
    ?.decorations.find()
    .find(
      (entry: { type: { attrs?: Record<string, string> } }) =>
        entry.type.attrs?.['data-link-role'] === 'content',
    )

  if (!decoration) {
    throw new Error('content decoration missing')
  }

  return decoration
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

describe('link extension hooks', () => {
  beforeEach(() => {
    mockRegisterLinkPlugins.mockReset()
    mockRegisterLinkPlugins.mockReturnValue(vi.fn())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('registers the wiki link plugin with the expected keys and rebuilds on selection/doc changes', () => {
    const editor = {
      _tiptapEditor: {},
    } as CustomBlockNoteEditor
    const resolver = createResolver(false)

    renderHook(() => useWikiLinkExtension(editor, resolver))

    expect(mockRegisterLinkPlugins).toHaveBeenCalledTimes(1)
    const options = mockRegisterLinkPlugins.mock.calls[0][0]
    expect(options.pluginKey.key).toContain('wikiLinkDecoration')
    expect(options.stabilizerKey.key).toContain('wikiLinkSelectionStabilizer')

    const plugin = options.createDecorationPlugin()
    const initialState = createEditorState(plugin, 'Intro [[Lore]] outro')
    const initialContent = getContentDecoration(initialState)
    expect(initialContent.type.attrs['data-link-active']).toBe('false')

    const activeState = initialState.apply(
      initialState.tr.setSelection(TextSelection.create(initialState.doc, initialContent.from + 1)),
    )
    expect(getContentDecoration(activeState).type.attrs['data-link-active']).toBe('true')

    const docChangedState = activeState.apply(
      activeState.tr.insertText(' [[Ghost Lore]]', activeState.doc.content.size - 1),
    )
    const contentDecorations = getContentDecorations(plugin, docChangedState)
    expect(contentDecorations).toHaveLength(2)
  })

  it('registers the md link plugin with the expected keys and recreates when viewer mode changes', () => {
    const editor = {
      _tiptapEditor: {},
    } as CustomBlockNoteEditor
    const { rerender } = renderHook(
      ({ resolver }: { resolver: LinkResolver }) => useMdLinkExtension(editor, resolver),
      { initialProps: { resolver: createResolver(false) } },
    )

    expect(mockRegisterLinkPlugins).toHaveBeenCalledTimes(1)
    let options = mockRegisterLinkPlugins.mock.calls[0][0]
    expect(options.pluginKey.key).toContain('mdLinkDecoration')
    expect(options.stabilizerKey.key).toContain('mdLinkSelectionStabilizer')

    let plugin = options.createDecorationPlugin()
    let state = createEditorState(plugin, 'See [Capital](Lore/Capital)')
    expect(getContentDecoration(state).type.attrs['data-link-viewer']).toBe('false')

    state = state.apply(state.tr.insertText(' [Ghost](Ghost/Note)', state.doc.content.size - 1))
    const contentDecorations = getContentDecorations(plugin, state)
    expect(contentDecorations).toHaveLength(2)

    rerender({ resolver: createResolver(true) })

    expect(mockRegisterLinkPlugins).toHaveBeenCalledTimes(2)
    options = mockRegisterLinkPlugins.mock.calls[1][0]
    plugin = options.createDecorationPlugin()
    state = createEditorState(plugin, 'See [Capital](Lore/Capital)')
    expect(getContentDecoration(state).type.attrs['data-link-viewer']).toBe('true')
  })
})
