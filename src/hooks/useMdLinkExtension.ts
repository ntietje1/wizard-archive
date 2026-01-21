import { useEffect, useMemo, useRef } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { useAllSidebarItems } from './useSidebarItems'
import { useCampaign } from './useCampaign'
import { useEditorMode } from './useEditorMode'
import { resolveItemByPath } from './useWikiLinkExtension'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { validateHexColorOrDefault } from '~/lib/sidebar-item-utils'

const PLUGIN_KEY = new PluginKey('mdLinkDecoration')

const TYPE_TO_URL_PARAM: Record<string, string> = {
  note: 'note',
  folder: 'folder',
  gameMap: 'map',
  file: 'file',
}

export interface MdLinkItemInfo {
  item: AnySidebarItem
  href: string
}

export interface ParsedMdLink {
  displayText: string
  target: string
  isExternal: boolean
  // For internal links:
  itemPath: Array<string>
  itemName: string
  headingPath: Array<string>
}

/**
 * Check if a string is an external URL (starts with http:// or https://)
 * We check the prefix directly rather than using URL parsing to avoid
 * false negatives for URLs that might not parse correctly.
 */
function isExternalUrl(str: string): boolean {
  const lower = str.toLowerCase()
  return lower.startsWith('http://') || lower.startsWith('https://')
}

/**
 * Parse the target portion of a markdown link
 */
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

  // Parse as internal path (similar to wikilink parsing)
  // Split by # to get item path and heading path
  const parts = target.split('#')
  const itemPathStr = parts[0].trim()
  const headingPath = parts
    .slice(1)
    .map((h) => h.trim())
    .filter(Boolean)

  // Split item path by / to get path segments
  const itemPath = itemPathStr
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
  const itemName = itemPath.at(-1) || ''

  return {
    target,
    isExternal: false,
    itemPath,
    itemName,
    headingPath,
  }
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

// Match [display text](target) where:
// - Display text: one or more characters that are not ]
// - Target: one or more characters that are not )
// Use negative lookahead to avoid matching if preceded by !
export const MD_LINK_REGEX = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g

export interface MdLinkResolver {
  resolve: (pathSegments: Array<string>) => MdLinkItemInfo | undefined
  allItems: Array<AnySidebarItem>
  itemsMap: Map<SidebarItemId, AnySidebarItem>
}

/**
 * Hook that applies markdown link styling to [text](link) patterns in the editor.
 * - In editor mode: brackets and target are hidden unless cursor/selection overlaps with the link
 * - In viewer mode: brackets and target are always hidden
 */
export function useMdLinkExtension(
  editor: CustomBlockNoteEditor | undefined,
) {
  const { data: sidebarItems, itemsMap } = useAllSidebarItems()
  const { dmUsername, campaignSlug } = useCampaign()
  const { editorMode } = useEditorMode()
  const pluginRef = useRef<Plugin | null>(null)
  const isViewerMode = editorMode === 'viewer'

  // Build resolver for path-based lookups
  const resolver = useMemo((): MdLinkResolver => {
    const allItems = sidebarItems || []

    const resolve = (pathSegments: Array<string>): MdLinkItemInfo | undefined => {
      if (!dmUsername || !campaignSlug || pathSegments.length === 0) return undefined

      const item = resolveItemByPath(pathSegments, allItems, itemsMap)
      if (!item) return undefined

      const urlParam = TYPE_TO_URL_PARAM[item.type]
      if (!urlParam) return undefined

      const href = `/campaigns/${dmUsername}/${campaignSlug}/editor?${urlParam}=${item.slug}`
      return { item, href }
    }

    return { resolve, allItems, itemsMap }
  }, [sidebarItems, itemsMap, dmUsername, campaignSlug])

  // Create and register the decoration plugin
  useEffect(() => {
    const tiptapEditor = editor?._tiptapEditor
    if (!tiptapEditor) return

    let cancelled = false
    let frameId: number | null = null

    const registerPluginWhenReady = () => {
      // Wait for the editor's view to be ready before registering plugins
      if (!tiptapEditor.view) {
        frameId = requestAnimationFrame(registerPluginWhenReady)
        return
      }

      if (cancelled) return

      const plugin = createMdLinkPlugin(resolver, isViewerMode)

      // Always try to unregister first (handles HMR and dependency changes)
      try {
        tiptapEditor.unregisterPlugin(PLUGIN_KEY)
      } catch {
        // Plugin might not be registered, that's fine
      }

      tiptapEditor.registerPlugin(plugin)
      pluginRef.current = plugin

      try {
        const { tr } = tiptapEditor.view.state
        tiptapEditor.view.dispatch(tr.setMeta(PLUGIN_KEY, true))
      } catch {
        // View might not be ready, decorations will apply on next transaction
      }
    }

    registerPluginWhenReady()

    return () => {
      cancelled = true
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
      // Always try to unregister on cleanup
      try {
        tiptapEditor.unregisterPlugin(PLUGIN_KEY)
      } catch {
        // Plugin might already be unregistered
      }
      pluginRef.current = null
    }
  }, [editor, resolver, isViewerMode])

  return { resolver }
}

// Block types that contain inline text content
const TEXT_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'toggleListItem',
])

// Find all markdown link matches in the document
// Uses textBetween to get text content that may span multiple nodes (e.g., when URLs are autolinked)
function findMdLinks(
  doc: {
    descendants: (
      fn: (
        node: { isText: boolean; text?: string; type: { name: string }; nodeSize: number },
        pos: number,
      ) => boolean | void,
    ) => void
    textBetween: (from: number, to: number) => string
    nodeSize: number
  },
  resolver: MdLinkResolver,
): Array<MdLinkMatch> {
  const matches: Array<MdLinkMatch> = []
  const regex = new RegExp(MD_LINK_REGEX.source, 'g')

  // Find text-containing blocks and search for links in their text content
  doc.descendants((node, pos) => {
    // Process block nodes that contain inline text
    if (!TEXT_BLOCK_TYPES.has(node.type.name)) return

    // Get the text content of this block using textBetween
    // This handles the case where URLs are autolinked (text spans multiple inline nodes)
    const nodeStart = pos
    const nodeEnd = pos + node.nodeSize
    const text = doc.textBetween(nodeStart, nodeEnd)

    if (!text) return

    let match
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      // Calculate document positions
      // +1 to account for the block opening tag
      const from = nodeStart + 1 + match.index
      const to = nodeStart + 1 + match.index + match[0].length
      const displayText = match[1]
      const target = match[2]
      const targetParsed = parseMdLinkTarget(target)
      const parsed: ParsedMdLink = {
        displayText,
        ...targetParsed,
      }

      // Resolve internal links using path
      const itemInfo = parsed.isExternal
        ? undefined
        : resolver.resolve(parsed.itemPath)

      matches.push({ from, to, displayText, target, parsed, itemInfo })
    }
  })

  return matches
}

// Check if a markdown link overlaps with the selection
function overlapsSelection(
  matchFrom: number,
  matchTo: number,
  selFrom: number,
  selTo: number,
): boolean {
  return selFrom <= matchTo && selTo >= matchFrom
}

function createMdLinkPlugin(
  resolver: MdLinkResolver,
  isViewerMode: boolean,
): Plugin<PluginState> {
  return new Plugin<PluginState>({
    key: PLUGIN_KEY,
    state: {
      init(_, { doc, selection }) {
        try {
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
        } catch {
          return {
            decorations: DecorationSet.empty,
            selFrom: selection.from,
            selTo: selection.to,
          }
        }
      },
      apply(tr, oldState, _oldEditorState, newEditorState) {
        try {
          const forceRebuild = tr.getMeta(PLUGIN_KEY)
          const { from: selFrom, to: selTo } = newEditorState.selection

          // If doc changed, rebuild everything
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

          // If selection changed, check if we need to rebuild
          if (tr.selectionSet && !isViewerMode) {
            const matches = findMdLinks(newEditorState.doc, resolver)

            // Check if the set of overlapping md-links changed
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
        } catch {
          return {
            decorations: DecorationSet.empty,
            selFrom: newEditorState.selection.from,
            selTo: newEditorState.selection.to,
          }
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
  matches: Array<MdLinkMatch>,
  isViewerMode: boolean,
  selFrom: number,
  selTo: number,
): DecorationSet {
  const decorations: Array<Decoration> = []

  for (const { from, to, displayText, target, parsed, itemInfo } of matches) {
    // Determine base class based on link type
    let baseClass: string
    if (parsed.isExternal) {
      baseClass = 'md-link-external'
    } else if (itemInfo) {
      baseClass = 'md-link-exists'
    } else {
      baseClass = 'md-link-ghost'
    }

    // Only apply item color for existing internal links - ghost links use CSS styling
    const color = !parsed.isExternal && itemInfo ? validateHexColorOrDefault(itemInfo.item.color) : undefined

    // Check if the selection overlaps with this md-link
    const isActive =
      !isViewerMode && overlapsSelection(from, to, selFrom, selTo)
    const activeClass = isActive ? ' md-link-active' : ''
    const viewerClass = isViewerMode ? ' md-link-viewer' : ''

    // Build href with heading parameter when heading exists
    let href = parsed.isExternal ? target : itemInfo?.href
    if (href && !parsed.isExternal && parsed.headingPath.length > 0) {
      const headingParam = encodeURIComponent(parsed.headingPath.join('#'))
      href = `${href}&heading=${headingParam}`
    }

    // Calculate positions for each part
    // [displayText](target)
    const openBracketEnd = from + 1 // [
    const displayEnd = from + 1 + displayText.length // [displayText
    const middleBracketEnd = displayEnd + 2 // [displayText](
    const targetEnd = middleBracketEnd + target.length // [displayText](target
    // to = targetEnd + 1 = [displayText](target)

    // Opening bracket [
    decorations.push(
      Decoration.inline(from, openBracketEnd, {
        nodeName: 'span',
        class: `md-link-bracket md-link-bracket-open ${baseClass}${viewerClass}${activeClass}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )

    // Display text
    decorations.push(
      Decoration.inline(openBracketEnd, displayEnd, {
        nodeName: 'span',
        class: `md-link-display ${baseClass}${activeClass}`,
        style: color ? `color: ${color}` : undefined,
        'data-md-link-type': parsed.isExternal ? 'external' : 'internal',
        'data-md-link-target': target,
        'data-md-link-exists': parsed.isExternal ? 'true' : itemInfo ? 'true' : 'false',
        ...(href && { 'data-href': href }),
        ...(!parsed.isExternal && parsed.itemName && {
          'data-md-link-item-name': parsed.itemName,
        }),
        ...(!parsed.isExternal && parsed.headingPath.length > 0 && {
          'data-md-link-heading': parsed.headingPath.join('#'),
        }),
      }),
    )

    // Middle bracket ](
    decorations.push(
      Decoration.inline(displayEnd, middleBracketEnd, {
        nodeName: 'span',
        class: `md-link-bracket md-link-bracket-middle ${baseClass}${viewerClass}${activeClass}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )

    // Target (URL or path)
    decorations.push(
      Decoration.inline(middleBracketEnd, targetEnd, {
        nodeName: 'span',
        class: `md-link-target ${baseClass}${viewerClass}${activeClass}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )

    // Closing bracket )
    decorations.push(
      Decoration.inline(targetEnd, to, {
        nodeName: 'span',
        class: `md-link-bracket md-link-bracket-close ${baseClass}${viewerClass}${activeClass}`,
        style: color ? `color: ${color}` : undefined,
      }),
    )
  }

  return DecorationSet.create(
    doc as Parameters<typeof DecorationSet.create>[0],
    decorations,
  )
}
