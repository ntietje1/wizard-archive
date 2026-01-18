import { useEffect, useMemo, useRef } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { useAllSidebarItems } from './useSidebarItems'
import { useCampaign } from './useCampaign'
import { useEditorMode } from './useEditorMode'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { validateHexColorOrDefault } from '~/lib/sidebar-item-utils'

const PLUGIN_KEY = new PluginKey('wikiLinkDecoration')

const TYPE_TO_URL_PARAM: Record<string, string> = {
  note: 'note',
  folder: 'folder',
  gameMap: 'map',
  file: 'file',
}

export interface WikiLinkItemInfo {
  item: AnySidebarItem
  href: string
}

export type WikiLinkItemsMap = Map<string, WikiLinkItemInfo>


export interface ParsedWikiLink {
  itemName: string // The file/note name
  headingPath: Array<string> // Array of heading anchors ["h1", "h2"]
  displayName: string | null // Optional display override
}


export function parseWikiLinkText(text: string): ParsedWikiLink {
  // Find last | for display name (allows | in item name)
  const lastPipeIndex = text.lastIndexOf('|')

  let displayName: string | null = null
  let remainingText = text

  if (lastPipeIndex !== -1) {
    displayName = text.slice(lastPipeIndex + 1).trim() || null
    remainingText = text.slice(0, lastPipeIndex)
  }

  // Split by # to get item name and heading path
  const parts = remainingText.split('#')
  const itemName = parts[0].trim()
  const headingPath = parts.slice(1).map((h) => h.trim()).filter(Boolean)

  return {
    itemName,
    headingPath,
    displayName,
  }
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

// Match [[content]] where:
// - Content cannot contain [[ (would look like nested link start)
// - Content cannot contain ]] followed by non-]
// - The final ]] must be followed by end or non-] to handle names ending with ]
export const WIKI_LINK_REGEX =
  /\[\[((?:(?!\[\[)(?!\]\][^\]]).)+?)\]\](?=$|[^\]])/g

/**
 * Hook that applies wiki-link styling to [[text]] patterns in the editor.
 * - In editor mode: brackets are hidden unless cursor/selection overlaps with the link
 * - In viewer mode: brackets are always hidden
 */
export function useWikiLinkExtension(
  editor: CustomBlockNoteEditor | undefined,
) {
  const { data: sidebarItems } = useAllSidebarItems()
  const { dmUsername, campaignSlug } = useCampaign()
  const { editorMode } = useEditorMode()
  const pluginRef = useRef<Plugin | null>(null)
  const isViewerMode = editorMode === 'viewer'

  // Build map of lowercase names to item info
  const itemsByName = useMemo((): WikiLinkItemsMap => {
    const map = new Map<string, WikiLinkItemInfo>()
    if (!sidebarItems || !dmUsername || !campaignSlug) return map

    for (const item of sidebarItems) {
      if (!item.name) continue
      const urlParam = TYPE_TO_URL_PARAM[item.type]
      if (!urlParam) continue

      const href = `/campaigns/${dmUsername}/${campaignSlug}/editor?${urlParam}=${item.slug}`
      map.set(item.name.toLowerCase(), { item, href })
    }
    return map
  }, [sidebarItems, dmUsername, campaignSlug])

  // Create and register the decoration plugin
  useEffect(() => {
    const tiptapEditor = editor?._tiptapEditor
    if (!tiptapEditor) return

    const plugin = createWikiLinkPlugin(itemsByName, isViewerMode)

    if (pluginRef.current) {
      tiptapEditor.unregisterPlugin(PLUGIN_KEY)
    }

    tiptapEditor.registerPlugin(plugin)
    pluginRef.current = plugin

    if (tiptapEditor.view) {
      const { tr } = tiptapEditor.view.state
      tiptapEditor.view.dispatch(tr.setMeta(PLUGIN_KEY, true))
    }

    return () => {
      if (pluginRef.current) {
        tiptapEditor.unregisterPlugin(PLUGIN_KEY)
        pluginRef.current = null
      }
    }
  }, [editor, itemsByName, isViewerMode])

  return { itemsByName }
}

// Find all wiki-link matches in the document
function findWikiLinks(
  doc: {
    descendants: (
      fn: (node: { isText: boolean; text?: string }, pos: number) => void,
    ) => void
  },
  itemsByName: WikiLinkItemsMap,
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
      const itemInfo = itemsByName.get(parsed.itemName.toLowerCase())
      matches.push({ from, to, innerText, parsed, itemInfo })
    }
  })

  return matches
}

// Check if a wiki-link overlaps with the selection
function overlapsSelection(
  matchFrom: number,
  matchTo: number,
  selFrom: number,
  selTo: number,
): boolean {
  return selFrom <= matchTo && selTo >= matchFrom
}

function createWikiLinkPlugin(
  itemsByName: WikiLinkItemsMap,
  isViewerMode: boolean,
): Plugin<PluginState> {
  return new Plugin<PluginState>({
    key: PLUGIN_KEY,
    state: {
      init(_, { doc, selection }) {
        const matches = findWikiLinks(doc, itemsByName)
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
      apply(tr, oldState, _oldEditorState, newEditorState) {
        const forceRebuild = tr.getMeta(PLUGIN_KEY)
        const { from: selFrom, to: selTo } = newEditorState.selection

        // If doc changed, rebuild everything
        if (tr.docChanged || forceRebuild) {
          const matches = findWikiLinks(newEditorState.doc, itemsByName)
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

        // If selection changed, check if we need to rebuild
        if (tr.selectionSet && !isViewerMode) {
          const matches = findWikiLinks(newEditorState.doc, itemsByName)

          // Check if the set of overlapping wiki-links changed
          const oldOverlapping = matches.filter((m) =>
            overlapsSelection(m.from, m.to, oldState.selFrom, oldState.selTo),
          )
          const newOverlapping = matches.filter((m) =>
            overlapsSelection(m.from, m.to, selFrom, selTo),
          )

          // Compare by checking if the sets are different
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

        // No changes needed, just map decorations and update selection
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
  doc: {
    descendants: (
      fn: (node: { isText: boolean; text?: string }, pos: number) => void,
    ) => void
  },
  matches: Array<WikiLinkMatch>,
  isViewerMode: boolean,
  selFrom: number,
  selTo: number,
): DecorationSet {
  const decorations: Array<Decoration> = []

  for (const { from, to, innerText, parsed, itemInfo } of matches) {
    const color = validateHexColorOrDefault(itemInfo?.item.color)
    const baseClass = itemInfo ? 'wiki-link-exists' : 'wiki-link-ghost'

    // Check if the selection overlaps with this wiki-link
    const isActive =
      !isViewerMode && overlapsSelection(from, to, selFrom, selTo)
    const activeClass = isActive ? ' wiki-link-active' : ''

    // Build href with heading parameter when heading exists
    let href = itemInfo?.href
    if (href && parsed.headingPath.length > 0) {
      const headingParam = encodeURIComponent(parsed.headingPath.join('#'))
      href = `${href}&heading=${headingParam}`
    }

    // Determine display text: displayName > itemName
    const displayText = parsed.displayName || parsed.itemName
    const hasDisplayName = !!parsed.displayName

    // Opening bracket [[
    decorations.push(
      Decoration.inline(from, from + 2, {
        nodeName: 'span',
        class: `wiki-link-bracket wiki-link-bracket-open ${baseClass}${isViewerMode ? ' wiki-link-viewer' : ''}${activeClass}`,
        style: itemInfo ? `color: ${color}` : undefined,
      }),
    )

    // Content (the text between brackets)
    decorations.push(
      Decoration.inline(from + 2, to - 2, {
        nodeName: 'span',
        class: `wiki-link-content ${baseClass}${activeClass}`,
        style: itemInfo ? `color: ${color}` : undefined,
        'data-wiki-link': innerText,
        'data-wiki-link-item-name': parsed.itemName,
        'data-wiki-link-exists': itemInfo ? 'true' : 'false',
        ...(href && { 'data-href': href }),
        ...(parsed.headingPath.length > 0 && {
          'data-wiki-link-heading': parsed.headingPath.join('#'),
        }),
        ...(hasDisplayName && { 'data-display-name': displayText }),
      }),
    )

    // Closing bracket ]]
    decorations.push(
      Decoration.inline(to - 2, to, {
        nodeName: 'span',
        class: `wiki-link-bracket wiki-link-bracket-close ${baseClass}${isViewerMode ? ' wiki-link-viewer' : ''}${activeClass}`,
        style: itemInfo ? `color: ${color}` : undefined,
      }),
    )
  }

  return DecorationSet.create(
    doc as Parameters<typeof DecorationSet.create>[0],
    decorations,
  )
}
