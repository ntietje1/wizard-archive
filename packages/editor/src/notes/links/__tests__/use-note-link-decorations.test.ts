import { renderHook } from '@testing-library/react'
import { EditorState, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Schema } from '@tiptap/pm/model'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ParsedLinkData, ResolvedLink } from '../../../../../../shared/links/types'
import type { Plugin } from '@tiptap/pm/state'
import type { LinkResolver } from '../../references/resolver'
import { useNoteLinkDecorations } from '../use-note-link-decorations'

type LinkDecorationEditor = Parameters<typeof useNoteLinkDecorations>[0]
type PresentLinkDecorationEditor = NonNullable<LinkDecorationEditor>

const { mockRegisterLinkPlugins } = vi.hoisted(() => ({
  mockRegisterLinkPlugins: vi.fn(),
}))

vi.mock('../plugin-registration', async () => {
  const actual = await vi.importActual<object>('../plugin-registration')
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
  marks: {
    strong: {
      toDOM: () => ['strong', 0],
    },
  },
})

function createDoc(
  text: string | Array<{ marks?: Array<keyof typeof schema.marks>; text: string }>,
) {
  const content =
    typeof text === 'string'
      ? schema.text(text)
      : text.map((part) =>
          schema.text(
            part.text,
            part.marks?.map((markName) => schema.marks[markName].create()),
          ),
        )
  return schema.node('doc', null, [schema.node('paragraph', null, content)])
}

function createResolver(isViewerMode: boolean, revision = 'catalog-1'): LinkResolver {
  const resolveLink = (parsed: ParsedLinkData): ResolvedLink => ({
    ...parsed,
    status: parsed.itemName.toLowerCase().includes('ghost') ? 'unresolved' : 'resolved',
    rejectionReason: null,
    itemId: null,
    itemSlug: parsed.isExternal ? null : parsed.itemName.toLowerCase(),
    href: parsed.isExternal
      ? parsed.rawTarget
      : `/campaigns/dm/world/editor?item=${parsed.itemName.toLowerCase()}`,
    color: parsed.isExternal ? null : '#224466',
  })

  return {
    revision,
    resolveLink,
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

function getLinkEnd(plugin: Plugin, state: EditorState) {
  return Math.max(
    ...plugin
      .getState(state)
      .decorations.find()
      .map((decoration: { to: number }) => decoration.to),
  )
}

function createEditorState(
  plugin: Plugin,
  text: string | Array<{ marks?: Array<keyof typeof schema.marks>; text: string }>,
) {
  const doc = createDoc(text)
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 1),
    plugins: [plugin],
  })
}

describe('useNoteLinkDecorations', () => {
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
    } as LinkDecorationEditor
    const resolver = createResolver(false)

    renderHook(() => useNoteLinkDecorations(editor, resolver))

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

  it('registers when the Tiptap editor becomes available after the outer editor', () => {
    const editor = {
      _tiptapEditor: undefined,
    } as PresentLinkDecorationEditor
    const resolver = createResolver(false)
    const { rerender } = renderHook(() => useNoteLinkDecorations(editor, resolver))

    expect(mockRegisterLinkPlugins).not.toHaveBeenCalled()

    editor._tiptapEditor = {} as never
    rerender()

    expect(mockRegisterLinkPlugins).toHaveBeenCalledTimes(1)
  })

  it('decorates wiki links split across adjacent marked text nodes', () => {
    const editor = {
      _tiptapEditor: {},
    } as LinkDecorationEditor
    const resolver = createResolver(false)

    renderHook(() => useNoteLinkDecorations(editor, resolver))

    const options = mockRegisterLinkPlugins.mock.calls[0][0]
    const plugin = options.createDecorationPlugin()
    const state = createEditorState(plugin, [
      { text: 'Intro [[Lo' },
      { text: 're]] outro', marks: ['strong'] },
    ])
    const contentDecorations = getContentDecorations(plugin, state)

    expect(contentDecorations).toHaveLength(1)
    expect(contentDecorations[0].type.attrs).toEqual(
      expect.objectContaining({
        'data-link-role': 'content',
        'data-link-type': 'wiki',
        'data-link-slug': 'lore',
      }),
    )
  })

  it('updates active and viewer state without re-registering', () => {
    const setMeta = vi.fn().mockReturnValue('force-rebuild-tr')
    const dispatch = vi.fn()
    const editor = {
      _tiptapEditor: {
        view: {
          state: { tr: { setMeta } },
          dispatch,
        },
      },
    } as unknown as LinkDecorationEditor
    const { rerender } = renderHook(
      ({ resolver, isViewerMode }: { resolver: LinkResolver; isViewerMode?: boolean }) =>
        useNoteLinkDecorations(editor, resolver, isViewerMode),
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
    expect(setMeta).toHaveBeenCalledWith(expect.any(PluginKey), true)
    expect(dispatch).toHaveBeenCalledWith('force-rebuild-tr')
    const viewerState = createEditorState(plugin, 'Intro [[Lore]] outro')
    expect(getContentDecorations(plugin, viewerState)[0].type.attrs['data-link-viewer']).toBe(
      'true',
    )
  })

  it('refreshes only when resolver meaning changes', () => {
    const setMeta = vi.fn().mockReturnValue('force-rebuild-tr')
    const dispatch = vi.fn()
    const editor = {
      _tiptapEditor: {
        view: {
          state: { tr: { setMeta } },
          dispatch,
        },
      },
    } as unknown as LinkDecorationEditor
    const { rerender } = renderHook(
      ({ resolver }: { resolver: LinkResolver }) => useNoteLinkDecorations(editor, resolver, false),
      { initialProps: { resolver: createResolver(false) } },
    )

    rerender({ resolver: createResolver(false) })
    expect(dispatch).not.toHaveBeenCalled()

    rerender({ resolver: createResolver(false, 'catalog-2') })
    expect(setMeta).toHaveBeenCalledWith(expect.any(PluginKey), true)
    expect(dispatch).toHaveBeenCalledWith('force-rebuild-tr')
  })

  it('treats a cursor at the end of a link as outside the active range', () => {
    const editor = {
      _tiptapEditor: {},
    } as LinkDecorationEditor
    const resolver = createResolver(false)

    renderHook(() => useNoteLinkDecorations(editor, resolver))

    const options = mockRegisterLinkPlugins.mock.calls[0][0]
    const plugin = options.createDecorationPlugin()
    const initialState = createEditorState(plugin, 'Intro [[Lore]] outro')
    const linkEnd = getLinkEnd(plugin, initialState)
    const activeState = initialState.apply(
      initialState.tr.setSelection(TextSelection.create(initialState.doc, linkEnd - 1)),
    )
    const afterLinkState = initialState.apply(
      initialState.tr.setSelection(TextSelection.create(initialState.doc, linkEnd)),
    )

    expect(getContentDecorations(plugin, activeState)[0].type.attrs['data-link-active']).toBe(
      'true',
    )
    expect(getContentDecorations(plugin, afterLinkState)[0].type.attrs['data-link-active']).toBe(
      'false',
    )
  })
})
