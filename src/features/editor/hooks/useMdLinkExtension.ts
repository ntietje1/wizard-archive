import { useEffect, useRef } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { MD_LINK_REGEX, parseMdLinkTarget } from 'convex/links/linkParsers'
import type { ParsedMdLinkFields } from 'convex/links/linkParsers'
import type { ResolvedLink } from 'convex/links/types'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { LinkResolver } from './useLinkResolver'
import {
  overlapsSelection,
  registerLinkPlugins,
} from '~/features/editor/utils/link-extension-utils'

const PLUGIN_KEY = new PluginKey('mdLinkDecoration')
const SELECTION_STABILIZER_KEY = new PluginKey('mdLinkSelectionStabilizer')

interface MdLinkMatch {
  from: number
  to: number
  displayText: string
  target: string
  parsed: ParsedMdLinkFields & { displayText: string }
  resolved: ResolvedLink
}

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

function findMdLinks(doc: ProseMirrorNode, resolver: LinkResolver): Array<MdLinkMatch> {
  const matches: Array<MdLinkMatch> = []
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
          decorations: buildDecorations(doc, matches, isViewerMode, selection.from, selection.to),
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
          const matches = findMdLinks(newEditorState.doc, resolver)
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
  matches: Array<MdLinkMatch>,
  isViewerMode: boolean,
  selFrom: number,
  selTo: number,
): DecorationSet {
  const decorations: Array<Decoration> = []

  for (const { from, to, displayText, target, parsed, resolved } of matches) {
    const baseClass = parsed.isExternal
      ? 'md-link-external'
      : resolved.resolved
        ? 'md-link-exists'
        : 'md-link-ghost'
    const color = resolved.color ?? undefined
    const isActive = !isViewerMode && overlapsSelection(from, to, selFrom, selTo)
    const classes = `${baseClass}${isViewerMode ? ' md-link-viewer' : ''}${isActive ? ' md-link-active' : ''}`

    const linkType = parsed.isExternal ? 'md-external' : 'md-internal'

    const openBracketEnd = from + 1
    const displayEnd = from + 1 + displayText.length
    const middleBracketEnd = displayEnd + 2
    const targetEnd = middleBracketEnd + target.length

    decorations.push(
      Decoration.inline(from, openBracketEnd, {
        nodeName: 'span',
        class: `md-link-bracket md-link-bracket-open ${classes}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )

    decorations.push(
      Decoration.inline(openBracketEnd, displayEnd, {
        nodeName: 'span',
        class: `md-link-display ${classes}`,
        style: color ? `color: ${color}` : undefined,
        'data-md-link-type': parsed.isExternal ? 'external' : 'internal',
        'data-md-link-target': target,
        'data-md-link-exists': parsed.isExternal || resolved.resolved ? 'true' : 'false',
        'data-link-exists': parsed.isExternal || resolved.resolved ? 'true' : 'false',
        'data-link-type': linkType,
        ...(resolved.href && {
          'data-href': resolved.href,
          'data-link-href': resolved.href,
        }),
        ...(!parsed.isExternal &&
          parsed.itemName && {
            'data-md-link-item-name': parsed.itemName,
            'data-link-item-name': parsed.itemName,
          }),
        ...(!parsed.isExternal &&
          parsed.headingPath.length > 0 && {
            'data-md-link-heading': parsed.headingPath.join('#'),
            'data-link-heading': parsed.headingPath.join('#'),
          }),
      }),
    )

    decorations.push(
      Decoration.inline(displayEnd, middleBracketEnd, {
        nodeName: 'span',
        class: `md-link-bracket md-link-bracket-middle ${classes}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )

    decorations.push(
      Decoration.inline(middleBracketEnd, targetEnd, {
        nodeName: 'span',
        class: `md-link-target ${classes}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )

    decorations.push(
      Decoration.inline(targetEnd, to, {
        nodeName: 'span',
        class: `md-link-bracket md-link-bracket-close ${classes}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )
  }

  return DecorationSet.create(doc, decorations)
}
