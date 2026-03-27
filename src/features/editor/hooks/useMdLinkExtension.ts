import { useEffect, useRef } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { resolveItemByPath } from './useWikiLinkExtension'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { validateHexColorOrDefault } from '~/features/sidebar/utils/sidebar-item-utils'
import {
  overlapsSelection,
  registerLinkPlugins,
} from '~/features/editor/utils/link-extension-utils'

const PLUGIN_KEY = new PluginKey('mdLinkDecoration')
const SELECTION_STABILIZER_KEY = new PluginKey('mdLinkSelectionStabilizer')

export interface MdLinkItemInfo {
  item: AnySidebarItem
  href: string
}

export interface ParsedMdLink {
  displayText: string
  target: string
  isExternal: boolean
  itemPath: Array<string>
  itemName: string
  headingPath: Array<string>
}

function isExternalUrl(str: string): boolean {
  const lower = str.toLowerCase()
  return lower.startsWith('http://') || lower.startsWith('https://')
}

function parseMdLinkTarget(target: string): Omit<ParsedMdLink, 'displayText'> {
  if (isExternalUrl(target)) {
    return {
      target,
      isExternal: true,
      itemPath: [],
      itemName: '',
      headingPath: [],
    }
  }

  const parts = target.split('#')
  const itemPathStr = parts[0].trim()
  const headingPath = parts
    .slice(1)
    .map((h) => h.trim())
    .filter(Boolean)
  const itemPath = itemPathStr
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
  const itemName = itemPath.at(-1) || ''

  return { target, isExternal: false, itemPath, itemName, headingPath }
}

interface MdLinkMatch {
  from: number
  to: number
  displayText: string
  target: string
  parsed: ParsedMdLink
  itemInfo: MdLinkItemInfo | undefined
}

interface PluginState {
  decorations: DecorationSet
  selFrom: number
  selTo: number
}

export const MD_LINK_REGEX = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g

export interface MdLinkResolver {
  resolve: (pathSegments: Array<string>) => MdLinkItemInfo | undefined
  allItems: Array<AnySidebarItem>
  itemsMap: Map<SidebarItemId, AnySidebarItem>
}

export function useMdLinkExtension(editor: CustomBlockNoteEditor | undefined) {
  const { data: sidebarItems, itemsMap } = useActiveSidebarItems()
  const { dmUsername, campaignSlug } = useCampaign()
  const { editorMode, viewAsPlayerId } = useEditorMode()
  const pluginRef = useRef<Plugin | null>(null)
  const isViewerMode = editorMode === 'viewer' || viewAsPlayerId !== undefined

  const allItems = sidebarItems || []

  const resolve = (pathSegments: Array<string>): MdLinkItemInfo | undefined => {
    if (!dmUsername || !campaignSlug || pathSegments.length === 0)
      return undefined

    const item = resolveItemByPath(pathSegments, allItems, itemsMap)
    if (!item) return undefined

    const href = `/campaigns/${dmUsername}/${campaignSlug}/editor?item=${item.slug}`
    return { item, href }
  }

  const resolver: MdLinkResolver = { resolve, allItems, itemsMap }

  useEffect(() => {
    const tiptapEditor = editor?._tiptapEditor
    if (!tiptapEditor) return

    return registerLinkPlugins({
      tiptapEditor,
      pluginKey: PLUGIN_KEY,
      stabilizerKey: SELECTION_STABILIZER_KEY,
      createDecorationPlugin: () => createMdLinkPlugin(resolver, isViewerMode),
      pluginRef,
    })
  }, [editor, resolver, isViewerMode])

  return { resolver }
}

const TEXT_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'toggleListItem',
])

function findMdLinks(
  doc: ProseMirrorNode,
  resolver: MdLinkResolver,
): Array<MdLinkMatch> {
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
      const parsed: ParsedMdLink = { displayText, ...parseMdLinkTarget(target) }
      const itemInfo = parsed.isExternal
        ? undefined
        : resolver.resolve(parsed.itemPath)
      matches.push({ from, to, displayText, target, parsed, itemInfo })
    }
  })

  return matches
}

function createMdLinkPlugin(
  resolver: MdLinkResolver,
  isViewerMode: boolean,
): Plugin<PluginState> {
  return new Plugin<PluginState>({
    key: PLUGIN_KEY,
    state: {
      init(_, { doc, selection }) {
        const matches = findMdLinks(doc, resolver)
        return {
          decorations: buildDecorations(
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
              (old, i) =>
                old.from !== newOverlapping[i]?.from ||
                old.to !== newOverlapping[i]?.to,
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

  for (const { from, to, displayText, target, parsed, itemInfo } of matches) {
    const baseClass = parsed.isExternal
      ? 'md-link-external'
      : itemInfo
        ? 'md-link-exists'
        : 'md-link-ghost'
    const color =
      !parsed.isExternal && itemInfo
        ? validateHexColorOrDefault(itemInfo.item.color)
        : undefined
    const isActive =
      !isViewerMode && overlapsSelection(from, to, selFrom, selTo)
    const classes = `${baseClass}${isViewerMode ? ' md-link-viewer' : ''}${isActive ? ' md-link-active' : ''}`

    let href = parsed.isExternal ? target : itemInfo?.href
    if (href && !parsed.isExternal && parsed.headingPath.length > 0) {
      href = `${href}&heading=${encodeURIComponent(parsed.headingPath.join('#'))}`
    }

    // Positions: [displayText](target)
    const openBracketEnd = from + 1
    const displayEnd = from + 1 + displayText.length
    const middleBracketEnd = displayEnd + 2
    const targetEnd = middleBracketEnd + target.length

    // Opening bracket [
    decorations.push(
      Decoration.inline(from, openBracketEnd, {
        nodeName: 'span',
        class: `md-link-bracket md-link-bracket-open ${classes}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )

    // Display text
    decorations.push(
      Decoration.inline(openBracketEnd, displayEnd, {
        nodeName: 'span',
        class: `md-link-display ${classes}`,
        style: color ? `color: ${color}` : undefined,
        'data-md-link-type': parsed.isExternal ? 'external' : 'internal',
        'data-md-link-target': target,
        'data-md-link-exists': parsed.isExternal || itemInfo ? 'true' : 'false',
        ...(href && { 'data-href': href }),
        ...(!parsed.isExternal &&
          parsed.itemName && { 'data-md-link-item-name': parsed.itemName }),
        ...(!parsed.isExternal &&
          parsed.headingPath.length > 0 && {
            'data-md-link-heading': parsed.headingPath.join('#'),
          }),
      }),
    )

    // Middle bracket ](
    decorations.push(
      Decoration.inline(displayEnd, middleBracketEnd, {
        nodeName: 'span',
        class: `md-link-bracket md-link-bracket-middle ${classes}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )

    // Target
    decorations.push(
      Decoration.inline(middleBracketEnd, targetEnd, {
        nodeName: 'span',
        class: `md-link-target ${classes}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )

    // Closing bracket )
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
