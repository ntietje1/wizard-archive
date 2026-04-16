import { useEffect, useRef } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'
import { MD_LINK_REGEX, parseMdLinkTarget } from 'convex/links/linkParsers'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { LinkResolver } from './useLinkResolver'
import type { MdLinkDecorationMatch } from '~/features/editor/utils/md-link-decorations'
import { registerLinkPlugins } from '~/features/editor/utils/link-extension-utils'
import { buildMdLinkDecorations } from '~/features/editor/utils/md-link-decorations'

const PLUGIN_KEY = new PluginKey('mdLinkDecoration')
const SELECTION_STABILIZER_KEY = new PluginKey('mdLinkSelectionStabilizer')

interface PluginState {
  decorations: DecorationSet
  selFrom: number
  selTo: number
}

const TEXT_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'toggleListItem',
])

export function useMdLinkExtension(
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
      createDecorationPlugin: () => createMdLinkPlugin(resolver, resolver.isViewerMode),
      pluginRef,
    })
  }, [editor, resolver, resolver.isViewerMode])
}

function findMdLinks(doc: ProseMirrorNode, resolver: LinkResolver): Array<MdLinkDecorationMatch> {
  const matches: Array<MdLinkDecorationMatch> = []
  const regex = new RegExp(MD_LINK_REGEX.source, 'g')

  doc.descendants((node, pos) => {
    if (!TEXT_BLOCK_TYPES.has(node.type.name)) return

    const nodeStart = pos
    const nodeEnd = pos + node.nodeSize
    const text = doc.textBetween(nodeStart, nodeEnd)
    if (!text) return

    let match
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      const from = nodeStart + 1 + match.index
      const to = nodeStart + 1 + match.index + match[0].length
      const displayText = match[1]
      const target = match[2]
      const parsed = { displayText, ...parseMdLinkTarget(target) }
      const resolved = resolver.resolveLink({
        syntax: 'md',
        itemPath: parsed.itemPath,
        itemName: parsed.itemName,
        headingPath: parsed.headingPath,
        displayName: displayText,
        rawTarget: target,
        isExternal: parsed.isExternal,
      })
      matches.push({ from, to, displayText, target, parsed, resolved })
    }
  })

  return matches
}

function createMdLinkPlugin(resolver: LinkResolver, isViewerMode: boolean): Plugin<PluginState> {
  return new Plugin<PluginState>({
    key: PLUGIN_KEY,
    state: {
      init(_, { doc, selection }) {
        const matches = findMdLinks(doc, resolver)
        return {
          decorations: buildMdLinkDecorations(
            doc,
            matches,
            isViewerMode,
            selection.from,
            selection.to,
          ),
          selFrom: selection.from,
          selTo: selection.to,
        }
      },
      apply(tr, oldState, _, newEditorState) {
        const forceRebuild = tr.getMeta(PLUGIN_KEY)
        const { from: selFrom, to: selTo } = newEditorState.selection

        if (tr.docChanged || forceRebuild) {
          const matches = findMdLinks(newEditorState.doc, resolver)
          return {
            decorations: buildMdLinkDecorations(
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
          const matches = findMdLinks(newEditorState.doc, resolver)
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
              decorations: buildMdLinkDecorations(
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
