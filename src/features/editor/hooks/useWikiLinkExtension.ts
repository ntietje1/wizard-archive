import { useEffect, useRef } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { WIKI_LINK_REGEX, parseWikiLinkText } from 'convex/links/linkParsers'
import type { ParsedWikiLinkFields } from 'convex/links/linkParsers'
import type { ResolvedLink } from 'convex/links/types'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { LinkResolver } from './useLinkResolver'
import {
  overlapsSelection,
  registerLinkPlugins,
} from '~/features/editor/utils/link-extension-utils'

const PLUGIN_KEY = new PluginKey('wikiLinkDecoration')
const SELECTION_STABILIZER_KEY = new PluginKey('wikiLinkSelectionStabilizer')

interface WikiLinkMatch {
  from: number
  to: number
  innerText: string
  parsed: ParsedWikiLinkFields
  resolved: ResolvedLink
}

interface PluginState {
  decorations: DecorationSet
  selFrom: number
  selTo: number
}

export function useWikiLinkExtension(
  editor: CustomBlockNoteEditor | undefined,
  resolver: LinkResolver,
) {
  const pluginRef = useRef<Plugin | null>(null)

  useEffect(() => {
    const tiptapEditor = editor?._tiptapEditor
    if (!tiptapEditor) return

    return registerLinkPlugins({
      tiptapEditor,
      pluginKey: PLUGIN_KEY,
      stabilizerKey: SELECTION_STABILIZER_KEY,
      createDecorationPlugin: () => createWikiLinkPlugin(resolver, resolver.isViewerMode),
      pluginRef,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, resolver, resolver.isViewerMode])
}

function findWikiLinks(doc: ProseMirrorNode, resolver: LinkResolver): Array<WikiLinkMatch> {
  const matches: Array<WikiLinkMatch> = []
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

function createWikiLinkPlugin(resolver: LinkResolver, isViewerMode: boolean): Plugin<PluginState> {
  return new Plugin<PluginState>({
    key: PLUGIN_KEY,
    state: {
      init(_, { doc, selection }) {
        const matches = findWikiLinks(doc, resolver)
        return {
          decorations: buildDecorations(doc, matches, isViewerMode, selection.from, selection.to),
          selFrom: selection.from,
          selTo: selection.to,
        }
      },
      apply(tr, oldState, _, newEditorState) {
        const forceRebuild = tr.getMeta(PLUGIN_KEY)
        const { from: selFrom, to: selTo } = newEditorState.selection

        if (tr.docChanged || forceRebuild) {
          const matches = findWikiLinks(newEditorState.doc, resolver)
          return {
            decorations: buildDecorations(
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
          const oldOverlapping = matches.filter((m) =>
            overlapsSelection(m.from, m.to, oldState.selFrom, oldState.selTo),
          )
          const newOverlapping = matches.filter((m) =>
            overlapsSelection(m.from, m.to, selFrom, selTo),
          )

          const overlappingChanged =
            oldOverlapping.length !== newOverlapping.length ||
            oldOverlapping.some(
              (old, i) => old.from !== newOverlapping[i]?.from || old.to !== newOverlapping[i]?.to,
            )

          if (overlappingChanged) {
            return {
              decorations: buildDecorations(
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

function buildDecorations(
  doc: ProseMirrorNode,
  matches: Array<WikiLinkMatch>,
  isViewerMode: boolean,
  selFrom: number,
  selTo: number,
): DecorationSet {
  const decorations: Array<Decoration> = []

  for (const { from, to, innerText, parsed, resolved } of matches) {
    const color = resolved.color ?? undefined
    const baseClass = resolved.resolved ? 'wiki-link-exists' : 'wiki-link-ghost'
    const isActive = !isViewerMode && overlapsSelection(from, to, selFrom, selTo)
    const classes = `${baseClass}${isViewerMode ? ' wiki-link-viewer' : ''}${isActive ? ' wiki-link-active' : ''}`

    const contentAttrs: Record<string, string | undefined> = {
      'data-wiki-link': innerText,
      'data-wiki-link-item-name': parsed.itemName,
      'data-wiki-link-exists': resolved.resolved ? 'true' : 'false',
      'data-link-exists': resolved.resolved ? 'true' : 'false',
      'data-link-item-name': parsed.itemName,
      'data-link-type': 'wiki',
      ...(resolved.href && {
        'data-href': resolved.href,
        'data-link-href': resolved.href,
      }),
      ...(parsed.headingPath.length > 0 && {
        'data-wiki-link-heading': parsed.headingPath.join('#'),
        'data-link-heading': parsed.headingPath.join('#'),
      }),
    }

    decorations.push(
      Decoration.inline(from, from + 2, {
        nodeName: 'span',
        class: `wiki-link-bracket wiki-link-bracket-open ${classes}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )

    if (parsed.displayName) {
      const pipeIndex = innerText.lastIndexOf('|')
      const prefixEnd = from + 2 + pipeIndex + 1

      decorations.push(
        Decoration.inline(from + 2, prefixEnd, {
          nodeName: 'span',
          class: `wiki-link-hidden-prefix ${classes}`,
          style: color ? `color: ${color}` : undefined,
        }),
      )
      decorations.push(
        Decoration.inline(prefixEnd, to - 2, {
          nodeName: 'span',
          class: `wiki-link-content ${classes}`,
          style: color ? `color: ${color}` : undefined,
          ...contentAttrs,
          'data-display-name': parsed.displayName,
        }),
      )
    } else {
      decorations.push(
        Decoration.inline(from + 2, to - 2, {
          nodeName: 'span',
          class: `wiki-link-content ${classes}`,
          style: color ? `color: ${color}` : undefined,
          ...contentAttrs,
        }),
      )
    }

    decorations.push(
      Decoration.inline(to - 2, to, {
        nodeName: 'span',
        class: `wiki-link-bracket wiki-link-bracket-close ${classes}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )
  }

  return DecorationSet.create(doc, decorations)
}
