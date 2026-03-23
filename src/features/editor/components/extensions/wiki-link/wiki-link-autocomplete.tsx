import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { getWikiLinkContext } from './wiki-link-utils'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { HeadingEntry } from '~/features/editor/utils/heading-utils'
import type { Id } from 'convex/_generated/dataModel'
import {
  buildBreadcrumbs,
  getItemTypeLabel,
} from '~/features/sidebar/utils/sidebar-item-utils'
import { extractHeadingsFromContent } from '~/features/editor/utils/heading-utils'
import { useAllSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import {
  getItemPath,
  getMinDisambiguationPath,
  resolveItemByPath,
} from '~/features/editor/hooks/useWikiLinkExtension'
import { filterSuggestionItems } from '~/features/editor/utils/filter-suggestion-items'
import './wiki-link-autocomplete.css'

type AutocompleteMode = 'file' | 'heading' | 'display-name'

interface FileItem {
  key: SidebarItemId
  title: string
  subtext: string
  badge: string
  item: AnySidebarItem
  /** The minimum path needed to uniquely identify this item (used for insertion) */
  linkPath: Array<string>
}
interface HeadingItem {
  key: string
  title: string
  level: 1 | 2 | 3
  heading: HeadingEntry
  fullPath: Array<string>
}

interface AutocompleteContext {
  mode: AutocompleteMode
  /** The current search query (last segment after final /) */
  fileQuery: string
  /** Completed folder path segments (folders typed with / after them) */
  completedFolderPath: Array<string>
  /** The resolved parent folder for the completed path, if any */
  resolvedParentFolder: AnySidebarItem | null
  headingQuery: string
  completedHeadingPath: Array<string>
  resolvedItem: AnySidebarItem | null
}

function getAutocompleteContext(
  query: string,
  allItems: Array<AnySidebarItem>,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
): AutocompleteContext {
  if (query.includes('|')) {
    return {
      mode: 'display-name',
      fileQuery: '',
      completedFolderPath: [],
      resolvedParentFolder: null,
      headingQuery: '',
      completedHeadingPath: [],
      resolvedItem: null,
    }
  }

  const hashIdx = query.indexOf('#')
  if (hashIdx === -1) {
    // File mode - split by / to get folder path and current query
    const segments = query.split('/')
    const currentQuery = segments.at(-1) || ''
    const completedFolderPath = segments
      .slice(0, -1)
      .map((s) => s.trim())
      .filter(Boolean)

    // Resolve the parent folder if we have a completed path
    const resolvedParentFolder =
      completedFolderPath.length > 0
        ? (resolveItemByPath(completedFolderPath, allItems, itemsMap) ?? null)
        : null

    return {
      mode: 'file',
      fileQuery: currentQuery,
      completedFolderPath,
      resolvedParentFolder,
      headingQuery: '',
      completedHeadingPath: [],
      resolvedItem: null,
    }
  }

  const filePath = query.slice(0, hashIdx)
  const filePathSegments = filePath
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)

  // Resolve the item using path-based lookup
  const item = resolveItemByPath(filePathSegments, allItems, itemsMap)

  // Only notes support heading links
  if (!item || item.type !== SIDEBAR_ITEM_TYPES.notes) {
    // Fall back to file mode
    const segments = query.split('/')
    const currentQuery = segments.at(-1) || ''
    const completedFolderPath = segments
      .slice(0, -1)
      .map((s) => s.trim())
      .filter(Boolean)
    const resolvedParentFolder =
      completedFolderPath.length > 0
        ? (resolveItemByPath(completedFolderPath, allItems, itemsMap) ?? null)
        : null

    return {
      mode: 'file',
      fileQuery: currentQuery,
      completedFolderPath,
      resolvedParentFolder,
      headingQuery: '',
      completedHeadingPath: [],
      resolvedItem: null,
    }
  }

  const parts = query.slice(hashIdx + 1).split('#')
  return {
    mode: 'heading',
    fileQuery: filePath,
    completedFolderPath: filePathSegments.slice(0, -1),
    resolvedParentFolder: null,
    headingQuery: parts.at(-1) || '',
    completedHeadingPath: parts.slice(0, -1),
    resolvedItem: item,
  }
}

/** Get child headings under a parent level, stopping at same-or-higher level */
function getChildHeadings(
  headings: Array<HeadingEntry>,
  parentLevel: number,
  startIdx: number,
): Array<HeadingEntry> {
  const children: Array<HeadingEntry> = []
  for (let i = startIdx; i < headings.length; i++) {
    if (headings[i].level <= parentLevel) break
    children.push(headings[i])
  }
  return children
}

/** Build heading items with paths for the autocomplete menu */
function buildHeadingItems(
  headings: Array<HeadingEntry>,
  completedPath: Array<string>,
  query: string,
): Array<HeadingItem> {
  let remaining = headings
  let parentLevel = 0

  // Walk through completed path segments
  for (const segment of completedPath) {
    const normalized = segment.toLowerCase().trim().replace(/\s+/g, ' ')
    if (!normalized) continue
    const idx = remaining.findIndex((h) => h.normalizedText === normalized)
    if (idx === -1) return []
    parentLevel = remaining[idx].level
    remaining = getChildHeadings(remaining, parentLevel, idx + 1)
  }

  // Build items with full paths
  const items: Array<HeadingItem> = []
  const parentAt = new Map<number, string>()

  for (const h of remaining) {
    parentAt.set(h.level, h.text)
    // Clear deeper levels
    for (const [lvl] of parentAt) if (lvl > h.level) parentAt.delete(lvl)

    const fullPath = [...parentAt.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, text]) => text)

    items.push({
      key: h.blockId,
      title: h.text,
      level: h.level,
      heading: h,
      fullPath,
    })
  }

  // Filter by query
  if (query) {
    const q = query.toLowerCase()
    return items.filter((i) => i.title.toLowerCase().includes(q))
  }
  return items
}

export function WikiLinkAutocomplete({
  editor,
}: {
  editor: CustomBlockNoteEditor | undefined
}) {
  const { data: sidebarItems, itemsMap } = useAllSidebarItems()

  const [menu, setMenu] = useState<{
    show: boolean
    query: string
    pos: DOMRect | null
  }>({
    show: false,
    query: '',
    pos: null,
  })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const hasEditedRef = useRef(false)

  const context = useMemo(
    () =>
      menu.show
        ? getAutocompleteContext(menu.query, sidebarItems, itemsMap)
        : null,
    [menu, sidebarItems, itemsMap],
  )

  const noteQuery = useAuthQuery(
    api.notes.queries.getNote,
    context?.mode === 'heading' && context.resolvedItem?._id
      ? { noteId: context.resolvedItem._id as Id<'notes'> }
      : 'skip',
  )

  const headings = useMemo(() => {
    if (!noteQuery.data) return []
    return extractHeadingsFromContent(noteQuery.data.content)
  }, [noteQuery.data])

  // Build filtered items
  const fileResult = ((): {
    items: Array<FileItem>
    totalCount: number
  } => {
    if (!sidebarItems || !itemsMap || context?.mode !== 'file')
      return { items: [], totalCount: 0 }

    // Filter items by parent folder if we have a completed folder path
    let itemsToShow = sidebarItems
    if (context.completedFolderPath.length > 0) {
      if (context.resolvedParentFolder) {
        // Show direct children of the resolved parent folder
        itemsToShow = sidebarItems.filter(
          (item) => item.parentId === context.resolvedParentFolder?._id,
        )
      } else {
        // No valid parent folder found, filter by path prefix match
        const normalizedPath = context.completedFolderPath.map((s) =>
          s.toLowerCase(),
        )
        itemsToShow = sidebarItems.filter((item) => {
          const itemPath = getItemPath(item, itemsMap).map((s) =>
            s.toLowerCase(),
          )
          // Item path must start with the completed folder path
          if (itemPath.length <= normalizedPath.length) return false
          return normalizedPath.every((segment, i) => itemPath[i] === segment)
        })
      }
    }

    const all = itemsToShow.map((item) => ({
      key: item._id,
      title: item.name,
      subtext: buildBreadcrumbs(item, itemsMap),
      badge: getItemTypeLabel(item.type),
      item,
      // Calculate the minimum path needed to uniquely identify this item
      linkPath: getMinDisambiguationPath(item, sidebarItems, itemsMap),
    }))
    const filtered = context.fileQuery
      ? filterSuggestionItems(all, context.fileQuery)
      : all
    return { items: filtered.slice(0, 10), totalCount: filtered.length }
  })()

  const headingResult = ((): {
    items: Array<HeadingItem>
    totalCount: number
  } => {
    if (context?.mode !== 'heading') return { items: [], totalCount: 0 }
    const all = buildHeadingItems(
      headings,
      context.completedHeadingPath,
      context.headingQuery,
    )
    return { items: all.slice(0, 10), totalCount: all.length }
  })()

  const fileItems = fileResult.items
  const headingItems = headingResult.items
  const items = context?.mode === 'heading' ? headingItems : fileItems
  const totalCount =
    context?.mode === 'heading'
      ? headingResult.totalCount
      : fileResult.totalCount
  const truncatedCount = totalCount - items.length

  // Reset selection on mode/path change
  const completedHeadingPath = context?.completedHeadingPath?.join('#')
  const completedFolderPath = context?.completedFolderPath?.join('/')
  const [prevResetKey, setPrevResetKey] = useState({
    mode: context?.mode,
    headingPath: completedHeadingPath,
    folderPath: completedFolderPath,
  })
  if (
    prevResetKey.mode !== context?.mode ||
    prevResetKey.headingPath !== completedHeadingPath ||
    prevResetKey.folderPath !== completedFolderPath
  ) {
    setPrevResetKey({
      mode: context?.mode,
      headingPath: completedHeadingPath,
      folderPath: completedFolderPath,
    })
    setSelectedIndex(0)
  }

  // Track dragging to hide menu during text selection
  useEffect(() => {
    const editorEl = editor?.domElement
    if (!editorEl) return
    const onDown = () => {
      setIsDragging(true)
      setMenu({ show: false, query: '', pos: null })
    }
    const onUp = () => setIsDragging(false)
    editorEl.addEventListener('mousedown', onDown)
    document.addEventListener('mouseup', onUp)
    return () => {
      editorEl.removeEventListener('mousedown', onDown)
      document.removeEventListener('mouseup', onUp)
    }
  }, [editor])

  // Listen to editor changes
  useEffect(() => {
    const tiptap = editor?._tiptapEditor
    if (!tiptap) return

    const onTransaction = ({
      transaction,
    }: {
      transaction: { docChanged: boolean }
    }) => {
      if (isDragging) return
      const ctx = getWikiLinkContext(editor)
      if (ctx) {
        if (transaction.docChanged) hasEditedRef.current = true
        if (!hasEditedRef.current) return
        const coords = tiptap.view?.coordsAtPos(ctx.startPos)
        const pos = coords
          ? new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top)
          : null
        setMenu({ show: true, query: ctx.query, pos })
      } else {
        hasEditedRef.current = false
        setMenu({ show: false, query: '', pos: null })
      }
    }

    tiptap.on('transaction', onTransaction)
    return () => {
      tiptap.off('transaction', onTransaction)
    }
  }, [editor, isDragging])

  const insertLink = useCallback(
    (item: FileItem | HeadingItem, ctx: AutocompleteContext | null) => {
      if (!editor || !ctx) return
      const wikiCtx = getWikiLinkContext(editor)
      if (!wikiCtx) return
      const tiptap = editor._tiptapEditor
      if (!tiptap) return

      const from = wikiCtx.startPos
      const to = wikiCtx.endPos

      // Build link text
      let linkText: string
      if (ctx.mode === 'file') {
        const fileItem = item as FileItem
        // Preserve the user's typed folder path + item name, or use min disambiguation path
        const pathParts =
          ctx.completedFolderPath.length > 0
            ? [...ctx.completedFolderPath, fileItem.title]
            : fileItem.linkPath
        const path = pathParts.join('/')
        // Add display name if path includes folders
        linkText = pathParts.length > 1 ? `${path}|${fileItem.title}` : path
      } else {
        const headingPath = [
          ...ctx.completedHeadingPath,
          ...(item as HeadingItem).fullPath,
        ].join('#')
        linkText = `${ctx.fileQuery}#${headingPath}`
      }

      tiptap
        .chain()
        .focus()
        .insertContentAt({ from, to }, `[[${linkText}]]`)
        .run()
      setMenu({ show: false, query: '', pos: null })
    },
    [editor],
  )

  const continueLink = useCallback(
    (item: FileItem | HeadingItem, ctx: AutocompleteContext | null) => {
      if (!editor || !ctx) return
      const wikiCtx = getWikiLinkContext(editor)
      if (!wikiCtx) return
      const tiptap = editor._tiptapEditor
      if (!tiptap) return

      const from = wikiCtx.startPos
      const to = wikiCtx.endPos

      // Build link text with trailing # to continue
      let linkText: string
      if (ctx.mode === 'file') {
        const fileItem = item as FileItem
        // Preserve the user's typed folder path + item name
        const pathParts = [...ctx.completedFolderPath, fileItem.title]
        linkText = pathParts.join('/')
      } else {
        const headingPath = [
          ...ctx.completedHeadingPath,
          ...(item as HeadingItem).fullPath,
        ].join('#')
        linkText = `${ctx.fileQuery}#${headingPath}`
      }

      tiptap
        .chain()
        .focus()
        .insertContentAt({ from, to }, `[[${linkText}#`)
        .run()
    },
    [editor],
  )

  const continueFolderPath = useCallback(
    (item: FileItem, ctx: AutocompleteContext | null) => {
      if (!editor || !ctx) return
      const wikiCtx = getWikiLinkContext(editor)
      if (!wikiCtx) return
      const tiptap = editor._tiptapEditor
      if (!tiptap) return

      const from = wikiCtx.startPos
      const to = wikiCtx.endPos

      // Build folder path with trailing / to continue
      const folderPath = item.linkPath.join('/')

      tiptap
        .chain()
        .focus()
        .insertContentAt({ from, to }, `[[${folderPath}/`)
        .run()
    },
    [editor],
  )

  // Keyboard navigation
  useEffect(() => {
    const editorEl = editor?.domElement
    if (!editorEl || !menu.show) return

    const onKeyDown = (e: KeyboardEvent) => {
      const len = items.length || 1
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => (i + 1) % len)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => (i - 1 + len) % len)
          break
        case 'Enter':
          e.preventDefault()
          if (items[selectedIndex]) insertLink(items[selectedIndex], context)
          break
        case 'Tab':
          e.preventDefault()
          if (context?.mode === 'file' && fileItems[selectedIndex]) {
            const selectedItem = fileItems[selectedIndex]
            if (selectedItem.item.type === SIDEBAR_ITEM_TYPES.notes) {
              // Notes: continue to heading selection with #
              continueLink(selectedItem, context)
            } else if (selectedItem.item.type === SIDEBAR_ITEM_TYPES.folders) {
              // Folders: continue folder path with /
              continueFolderPath(selectedItem, context)
            } else {
              insertLink(selectedItem, context)
            }
          } else if (
            context?.mode === 'heading' &&
            headingItems[selectedIndex]
          ) {
            continueLink(headingItems[selectedIndex], context)
          } else {
            setMenu({ show: false, query: '', pos: null })
          }
          break
        case 'Escape':
          e.preventDefault()
          setMenu({ show: false, query: '', pos: null })
          break
      }
    }

    editorEl.addEventListener('keydown', onKeyDown, true)
    return () => editorEl.removeEventListener('keydown', onKeyDown, true)
  }, [
    editor,
    menu.show,
    items,
    selectedIndex,
    insertLink,
    continueLink,
    continueFolderPath,
    context,
    fileItems,
    headingItems,
  ])

  if (!editor || !menu.show || !menu.pos || context?.mode === 'display-name')
    return null

  const isHeading = context?.mode === 'heading'
  const loading = isHeading && noteQuery.isPending

  return (
    <div
      className="wiki-link-menu-container"
      style={{
        position: 'fixed',
        left: menu.pos.left,
        top: menu.pos.bottom + 4,
        zIndex: 2000,
      }}
    >
      <div className="wiki-link-menu">
        {isHeading && context?.resolvedItem && (
          <div className="wiki-link-menu-header">
            Headings in "{context.resolvedItem.name}"
            {context.completedHeadingPath.length > 0 && (
              <span className="wiki-link-menu-path">
                {' '}
                &gt; {context.completedHeadingPath.join(' > ')}
              </span>
            )}
          </div>
        )}
        <ScrollArea className="wiki-link-menu-scroll-area">
          {loading ? (
            <div className="wiki-link-menu-empty">Loading headings...</div>
          ) : items.length === 0 ? (
            <div className="wiki-link-menu-empty">
              {isHeading ? 'No headings found' : 'No matches found'}
            </div>
          ) : isHeading ? (
            <div className="wiki-link-menu-items">
              {headingItems.map((item, i) => (
                <div
                  key={item.key}
                  onClick={() => insertLink(item, context)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`wiki-link-menu-item ${i === selectedIndex ? 'selected' : ''}`}
                >
                  <div className="wiki-link-menu-item-title-row">
                    <span
                      className="wiki-link-menu-item-title"
                      style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                    >
                      {'#'.repeat(item.level)} {item.title}
                    </span>
                    <span className="wiki-link-menu-badge">H{item.level}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="wiki-link-menu-items">
              {fileItems.map((item, i) => (
                <div
                  key={item.key}
                  onClick={() => insertLink(item, context)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`wiki-link-menu-item ${i === selectedIndex ? 'selected' : ''}`}
                >
                  <div className="wiki-link-menu-item-title-row">
                    <span className="wiki-link-menu-item-title">
                      {item.title}
                    </span>
                    <span className="wiki-link-menu-badge">{item.badge}</span>
                  </div>
                  {item.subtext && (
                    <div className="wiki-link-menu-item-subtext">
                      {item.subtext}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="wiki-link-menu-footer">
          {truncatedCount > 0 && <span>+{truncatedCount} more</span>}
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>tab continue</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
