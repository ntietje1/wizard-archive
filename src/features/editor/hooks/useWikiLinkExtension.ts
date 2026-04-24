import { useEffect, useRef } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'
import { WIKI_LINK_REGEX, parseWikiLinkText } from 'convex/links/linkParsers'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { LinkResolver } from './useLinkResolver'
import type { WikiLinkDecorationMatch } from '~/features/editor/utils/wiki-link-decorations'
import { registerLinkPlugins } from '~/features/editor/utils/link-extension-utils'
import { buildWikiLinkDecorations } from '~/features/editor/utils/wiki-link-decorations'

const PLUGIN_KEY = new PluginKey('wikiLinkDecoration')
const SELECTION_STABILIZER_KEY = new PluginKey('wikiLinkSelectionStabilizer')

interface PluginState {
  decorations: DecorationSet
  selFrom: number
  selTo: number
}

export function useWikiLinkExtension(
  editor: CustomBlockNoteEditor | undefined,
  resolver: LinkResolver,
  isViewerMode = resolver.isViewerMode,
) {
  const pluginRef = useRef<Plugin | null>(null)
  const resolverRef = useRef(resolver)
  const isViewerModeRef = useRef(isViewerMode)
  resolverRef.current = resolver
  isViewerModeRef.current = isViewerMode

  useEffect(() => {
    const tiptapEditor = editor?._tiptapEditor
    if (!tiptapEditor) return

    return registerLinkPlugins({
      tiptapEditor,
      pluginKey: PLUGIN_KEY,
      stabilizerKey: SELECTION_STABILIZER_KEY,
      createDecorationPlugin: () =>
        createWikiLinkPlugin(
          () => resolverRef.current,
          () => isViewerModeRef.current,
        ),
      pluginRef,
    })
  }, [editor])

  useEffect(() => {
    const view = editor?._tiptapEditor?.view
    if (!view) return

    view.dispatch(view.state.tr.setMeta(PLUGIN_KEY, true))
  }, [editor, resolver, isViewerMode])
}

function findWikiLinks(
  doc: ProseMirrorNode,
  resolver: LinkResolver,
): Array<WikiLinkDecorationMatch> {
  const matches: Array<WikiLinkDecorationMatch> = []
  const regex = new RegExp(WIKI_LINK_REGEX.source, 'g')

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    let match
    while ((match = regex.exec(node.text)) !== null) {
      const from = pos + match.index
      const to = pos + match.index + match[0].length
      const innerText = match[1]
      const parsed = parseWikiLinkText(innerText)
      const resolved = resolver.resolveLink({
        syntax: 'wiki',
        pathKind: parsed.pathKind,
        itemPath: parsed.itemPath,
        itemName: parsed.itemName,
        headingPath: parsed.headingPath,
        displayName: parsed.displayName,
        rawTarget: innerText,
        isExternal: false,
      })
      matches.push({ from, to, innerText, parsed, resolved })
    }
  })

  return matches
}

function createWikiLinkPlugin(
  getResolver: () => LinkResolver,
  getIsViewerMode: () => boolean,
): Plugin<PluginState> {
  return new Plugin<PluginState>({
    key: PLUGIN_KEY,
    state: {
      init(_, { doc, selection }) {
        const resolver = getResolver()
        const matches = findWikiLinks(doc, resolver)
        return {
          decorations: buildWikiLinkDecorations(
            doc,
            matches,
            getIsViewerMode(),
            selection.from,
            selection.to,
          ),
          selFrom: selection.from,
          selTo: selection.to,
        }
      },
      apply(tr, oldState, _, newEditorState) {
        const resolver = getResolver()
        const isViewerMode = getIsViewerMode()
        const forceRebuild = tr.getMeta(PLUGIN_KEY)
        const { from: selFrom, to: selTo } = newEditorState.selection

        if (tr.docChanged || forceRebuild) {
          const matches = findWikiLinks(newEditorState.doc, resolver)
          return {
            decorations: buildWikiLinkDecorations(
              newEditorState.doc,
              matches,
              isViewerMode,
              selFrom,
              selTo,
            ),
            selFrom,
            selTo,
          }
        }

        if (tr.selectionSet && !isViewerMode) {
          const matches = findWikiLinks(newEditorState.doc, resolver)
          const oldOverlapping = matches.filter(
            (m) => oldState.selFrom <= m.to && oldState.selTo >= m.from,
          )
          const newOverlapping = matches.filter((m) => selFrom <= m.to && selTo >= m.from)
          const overlappingChanged =
            oldOverlapping.length !== newOverlapping.length ||
            oldOverlapping.some(
              (old, i) => old.from !== newOverlapping[i]?.from || old.to !== newOverlapping[i]?.to,
            )

          if (overlappingChanged) {
            return {
              decorations: buildWikiLinkDecorations(
                newEditorState.doc,
                matches,
                isViewerMode,
                selFrom,
                selTo,
              ),
              selFrom,
              selTo,
            }
          }
        }

        return {
          decorations: oldState.decorations.map(tr.mapping, tr.doc),
          selFrom,
          selTo,
        }
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)?.decorations || DecorationSet.empty
      },
    },
  })
}
