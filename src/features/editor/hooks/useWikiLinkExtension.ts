import { useEffect, useMemo, useRef } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAllSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { validateHexColorOrDefault } from '~/features/sidebar/utils/sidebar-item-utils'
import {
  TYPE_TO_URL_PARAM,
  overlapsSelection,
  registerLinkPlugins,
} from '~/features/editor/utils/link-extension-utils'

const PLUGIN_KEY = new PluginKey('wikiLinkDecoration')
const SELECTION_STABILIZER_KEY = new PluginKey('wikiLinkSelectionStabilizer')

export interface WikiLinkItemInfo {
  item: AnySidebarItem
  href: string
}

export interface ParsedWikiLink {
  itemPath: Array<string>
  itemName: string
  headingPath: Array<string>
  displayName: string | null
}

export function parseWikiLinkText(text: string): ParsedWikiLink {
  const lastPipeIndex = text.lastIndexOf('|')
  let displayName: string | null = null
  let remainingText = text

  if (lastPipeIndex !== -1) {
    displayName = text.slice(lastPipeIndex + 1).trim() || null
    remainingText = text.slice(0, lastPipeIndex)
  }

  const parts = remainingText.split('#')
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

  return { itemPath, itemName, headingPath, displayName }
}

export function getItemPath(
  item: AnySidebarItem,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
): Array<string> {
  const path: Array<string> = []
  let current: AnySidebarItem | undefined = item
  const seen = new Set<SidebarItemId>()

  while (current && !seen.has(current._id)) {
    seen.add(current._id)
    if (current.name) path.unshift(current.name)
    current = current.parentId ? itemsMap.get(current.parentId) : undefined
  }

  return path
}

export function resolveItemByPath(
  pathSegments: Array<string>,
  allItems: Array<AnySidebarItem>,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
): AnySidebarItem | undefined {
  if (pathSegments.length === 0) return undefined

  const normalizedPath = pathSegments.map((s) => s.toLowerCase())

  for (const item of allItems) {
    const fullPath = getItemPath(item, itemsMap).map((s) => s.toLowerCase())
    if (fullPath.length < normalizedPath.length) continue

    const startIdx = fullPath.length - normalizedPath.length
    if (normalizedPath.every((seg, i) => fullPath[startIdx + i] === seg)) {
      return item
    }
  }

  return undefined
}

function isPathUnique(
  pathSegments: Array<string>,
  allItems: Array<AnySidebarItem>,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
): boolean {
  if (pathSegments.length === 0) return false

  const normalizedPath = pathSegments.map((s) => s.toLowerCase())
  let matchCount = 0

  for (const item of allItems) {
    const fullPath = getItemPath(item, itemsMap).map((s) => s.toLowerCase())
    if (fullPath.length < normalizedPath.length) continue

    const startIdx = fullPath.length - normalizedPath.length
    if (normalizedPath.every((seg, i) => fullPath[startIdx + i] === seg)) {
      matchCount++
      if (matchCount > 1) return false
    }
  }

  return matchCount === 1
}

export function getMinDisambiguationPath(
  item: AnySidebarItem,
  allItems: Array<AnySidebarItem>,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
): Array<string> {
  const fullPath = getItemPath(item, itemsMap)
  if (fullPath.length === 0) return []

  for (let i = fullPath.length - 1; i >= 0; i--) {
    const partialPath = fullPath.slice(i)
    if (isPathUnique(partialPath, allItems, itemsMap)) {
      return partialPath
    }
  }

  return fullPath
}

interface WikiLinkMatch {
  from: number
  to: number
  innerText: string
  parsed: ParsedWikiLink
  itemInfo: WikiLinkItemInfo | undefined
}

interface PluginState {
  decorations: DecorationSet
  selFrom: number
  selTo: number
}

export const WIKI_LINK_REGEX =
  /\[\[((?:(?!\[\[)(?!\]\][^\]]).)+?)\]\](?=$|[^\]])/g

export interface WikiLinkResolver {
  resolve: (pathSegments: Array<string>) => WikiLinkItemInfo | undefined
  allItems: Array<AnySidebarItem>
  itemsMap: Map<SidebarItemId, AnySidebarItem>
}

export function useWikiLinkExtension(
  editor: CustomBlockNoteEditor | undefined,
) {
  const { data: sidebarItems, itemsMap } = useAllSidebarItems()
  const { dmUsername, campaignSlug } = useCampaign()
  const { editorMode, viewAsPlayerId } = useEditorMode()
  const pluginRef = useRef<Plugin | null>(null)
  const isViewerMode = editorMode === 'viewer' || viewAsPlayerId !== undefined

  const resolver = useMemo((): WikiLinkResolver => {
    const allItems = sidebarItems || []

    const resolve = (
      pathSegments: Array<string>,
    ): WikiLinkItemInfo | undefined => {
      if (!dmUsername || !campaignSlug || pathSegments.length === 0)
        return undefined

      const item = resolveItemByPath(pathSegments, allItems, itemsMap)
      if (!item) return undefined

      const urlParam = TYPE_TO_URL_PARAM[item.type]
      if (!urlParam) return undefined

      const href = `/campaigns/${dmUsername}/${campaignSlug}/editor?${urlParam}=${item.slug}`
      return { item, href }
    }

    return { resolve, allItems, itemsMap }
  }, [sidebarItems, itemsMap, dmUsername, campaignSlug])

  useEffect(() => {
    const tiptapEditor = editor?._tiptapEditor
    if (!tiptapEditor) return

    return registerLinkPlugins({
      tiptapEditor,
      pluginKey: PLUGIN_KEY,
      stabilizerKey: SELECTION_STABILIZER_KEY,
      createDecorationPlugin: () =>
        createWikiLinkPlugin(resolver, isViewerMode),
      pluginRef,
    })
  }, [editor, resolver, isViewerMode])

  return { resolver }
}

function findWikiLinks(
  doc: ProseMirrorNode,
  resolver: WikiLinkResolver,
): Array<WikiLinkMatch> {
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
      const itemInfo = resolver.resolve(parsed.itemPath)
      matches.push({ from, to, innerText, parsed, itemInfo })
    }
  })

  return matches
}

function createWikiLinkPlugin(
  resolver: WikiLinkResolver,
  isViewerMode: boolean,
): Plugin<PluginState> {
  return new Plugin<PluginState>({
    key: PLUGIN_KEY,
    state: {
      init(_, { doc, selection }) {
        const matches = findWikiLinks(doc, resolver)
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
  matches: Array<WikiLinkMatch>,
  isViewerMode: boolean,
  selFrom: number,
  selTo: number,
): DecorationSet {
  const decorations: Array<Decoration> = []

  for (const { from, to, innerText, parsed, itemInfo } of matches) {
    const color = itemInfo
      ? validateHexColorOrDefault(itemInfo.item.color)
      : undefined
    const baseClass = itemInfo ? 'wiki-link-exists' : 'wiki-link-ghost'
    const isActive =
      !isViewerMode && overlapsSelection(from, to, selFrom, selTo)
    const classes = `${baseClass}${isViewerMode ? ' wiki-link-viewer' : ''}${isActive ? ' wiki-link-active' : ''}`

    let href = itemInfo?.href
    if (href && parsed.headingPath.length > 0) {
      href = `${href}&heading=${encodeURIComponent(parsed.headingPath.join('#'))}`
    }

    const contentAttrs = {
      'data-wiki-link': innerText,
      'data-wiki-link-item-name': parsed.itemName,
      'data-wiki-link-exists': itemInfo ? 'true' : 'false',
      ...(href && { 'data-href': href }),
      ...(parsed.headingPath.length > 0 && {
        'data-wiki-link-heading': parsed.headingPath.join('#'),
      }),
    }

    // Opening bracket [[
    decorations.push(
      Decoration.inline(from, from + 2, {
        nodeName: 'span',
        class: `wiki-link-bracket wiki-link-bracket-open ${classes}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )

    // Content - in viewer mode with display name, split to make display name selectable
    if (isViewerMode && parsed.displayName) {
      const pipeIndex = innerText.lastIndexOf('|')
      const prefixEnd = from + 2 + pipeIndex + 1

      decorations.push(
        Decoration.inline(from + 2, prefixEnd, {
          nodeName: 'span',
          class: 'wiki-link-hidden-prefix',
        }),
      )
      decorations.push(
        Decoration.inline(prefixEnd, to - 2, {
          nodeName: 'span',
          class: `wiki-link-content ${classes}`,
          style: color ? `color: ${color}` : undefined,
          ...contentAttrs,
        }),
      )
    } else {
      decorations.push(
        Decoration.inline(from + 2, to - 2, {
          nodeName: 'span',
          class: `wiki-link-content ${classes}`,
          style: color ? `color: ${color}` : undefined,
          ...contentAttrs,
          ...(parsed.displayName && {
            'data-display-name': parsed.displayName,
          }),
        }),
      )
    }

    // Closing bracket ]]
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
