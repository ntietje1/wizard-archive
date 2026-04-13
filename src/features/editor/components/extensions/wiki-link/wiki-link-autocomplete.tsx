import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { getWikiLinkContext } from './wiki-link-utils'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { HeadingEntry } from '~/features/editor/utils/heading-utils'
import type { Id } from 'convex/_generated/dataModel'
import { buildBreadcrumbs, getItemTypeLabel } from '~/features/sidebar/utils/sidebar-item-utils'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { SearchResultItem } from '~/features/search/components/search-result-item'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import {
  getItemPath,
  getMinDisambiguationPath,
  resolveItemByPath,
} from '~/features/editor/hooks/useWikiLinkExtension'
import { filterSuggestionItems } from '~/features/editor/utils/filter-suggestion-items'

type AutocompleteMode = 'file' | 'heading' | 'display-name'

interface FileItem {
  key: Id<'sidebarItems'>
  title: string
  subtext: string
  badge: string
  item: AnySidebarItem
  linkPath: Array<string>
}

interface HeadingItem {
  key: string
  title: string
  level: 1 | 2 | 3 | 4 | 5 | 6
  heading: HeadingEntry
  fullPath: Array<string>
}

interface AutocompleteContext {
  mode: AutocompleteMode
  fileQuery: string
  completedFolderPath: Array<string>
  resolvedParentFolder: AnySidebarItem | null
  headingQuery: string
  completedHeadingPath: Array<string>
  resolvedItem: AnySidebarItem | null
}

function getAutocompleteContext(
  query: string,
  allItems: Array<AnySidebarItem>,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
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

  const filePath = query.slice(0, hashIdx)
  const filePathSegments = filePath
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)

  const item = resolveItemByPath(filePathSegments, allItems, itemsMap)

  if (!item || item.type !== SIDEBAR_ITEM_TYPES.notes) {
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

function buildHeadingItems(
  headings: Array<HeadingEntry>,
  completedPath: Array<string>,
  query: string,
): Array<HeadingItem> {
  let remaining = headings
  let parentLevel = 0

  for (const segment of completedPath) {
    const normalized = segment.toLowerCase().trim().replace(/\s+/g, ' ')
    if (!normalized) continue
    const idx = remaining.findIndex((h) => h.normalizedText === normalized)
    if (idx === -1) return []
    parentLevel = remaining[idx].level
    remaining = getChildHeadings(remaining, parentLevel, idx + 1)
  }

  const items: Array<HeadingItem> = []
  const parentAt = new Map<number, string>()

  for (const h of remaining) {
    parentAt.set(h.level, h.text)
    for (const [lvl] of parentAt) if (lvl > h.level) parentAt.delete(lvl)

    const fullPath = [...parentAt.entries()].sort(([a], [b]) => a - b).map(([, text]) => text)

    items.push({
      key: h.blockNoteId,
      title: h.text,
      level: h.level,
      heading: h,
      fullPath,
    })
  }

  if (query) {
    const q = query.toLowerCase()
    return items.filter((i) => i.title.toLowerCase().includes(q))
  }
  return items
}

export function WikiLinkAutocomplete({ editor }: { editor: CustomBlockNoteEditor | undefined }) {
  const { data: sidebarItems, itemsMap } = useActiveSidebarItems()

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
  const selectedItemRef = useRef<HTMLDivElement>(null)

  const context = menu.show ? getAutocompleteContext(menu.query, sidebarItems, itemsMap) : null

  const headingsQuery = useCampaignQuery(
    api.blocks.queries.getHeadingsByNote,
    context?.mode === 'heading' && context.resolvedItem?._id
      ? { noteId: context.resolvedItem._id }
      : 'skip',
  )

  const headings = headingsQuery.data ?? []

  const fileResult = ((): {
    items: Array<FileItem>
    totalCount: number
  } => {
    if (!sidebarItems || !itemsMap || context?.mode !== 'file') return { items: [], totalCount: 0 }

    let itemsToShow = sidebarItems
    if (context.completedFolderPath.length > 0) {
      if (context.resolvedParentFolder) {
        itemsToShow = sidebarItems.filter(
          (item) => item.parentId === context.resolvedParentFolder?._id,
        )
      } else {
        const normalizedPath = context.completedFolderPath.map((s) => s.toLowerCase())
        itemsToShow = sidebarItems.filter((item) => {
          const itemPath = getItemPath(item, itemsMap).map((s) => s.toLowerCase())
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
      linkPath: getMinDisambiguationPath(item, sidebarItems, itemsMap),
    }))
    const filtered = context.fileQuery ? filterSuggestionItems(all, context.fileQuery) : all
    return { items: filtered.slice(0, 10), totalCount: filtered.length }
  })()

  const headingResult = ((): {
    items: Array<HeadingItem>
    totalCount: number
  } => {
    if (context?.mode !== 'heading') return { items: [], totalCount: 0 }
    const all = buildHeadingItems(headings, context.completedHeadingPath, context.headingQuery)
    return { items: all.slice(0, 10), totalCount: all.length }
  })()

  const fileItems = fileResult.items
  const headingItems = headingResult.items
  const items = context?.mode === 'heading' ? headingItems : fileItems
  const totalCount = context?.mode === 'heading' ? headingResult.totalCount : fileResult.totalCount
  const truncatedCount = totalCount - items.length

  const completedHeadingPath = context?.completedHeadingPath?.join('#')
  const completedFolderPath = context?.completedFolderPath?.join('/')
  const prevResetKeyRef = useRef({
    mode: context?.mode,
    headingPath: completedHeadingPath,
    folderPath: completedFolderPath,
  })
  if (
    prevResetKeyRef.current.mode !== context?.mode ||
    prevResetKeyRef.current.headingPath !== completedHeadingPath ||
    prevResetKeyRef.current.folderPath !== completedFolderPath
  ) {
    prevResetKeyRef.current = {
      mode: context?.mode,
      headingPath: completedHeadingPath,
      folderPath: completedFolderPath,
    }
    setSelectedIndex(0)
  }

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

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

  useEffect(() => {
    const tiptap = editor?._tiptapEditor
    if (!tiptap) return

    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
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

      let linkText: string
      if (ctx.mode === 'file') {
        const fileItem = item as FileItem
        const pathParts =
          ctx.completedFolderPath.length > 0
            ? [...ctx.completedFolderPath, fileItem.title]
            : fileItem.linkPath
        const path = pathParts.join('/')
        linkText = pathParts.length > 1 ? `${path}|${fileItem.title}` : path
      } else {
        const headingPath = [...ctx.completedHeadingPath, ...(item as HeadingItem).fullPath].join(
          '#',
        )
        linkText = `${ctx.fileQuery}#${headingPath}`
      }

      tiptap.chain().focus().insertContentAt({ from, to }, `[[${linkText}]]`).run()
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

      let linkText: string
      if (ctx.mode === 'file') {
        const fileItem = item as FileItem
        const pathParts = [...ctx.completedFolderPath, fileItem.title]
        linkText = pathParts.join('/')
      } else {
        const headingPath = [...ctx.completedHeadingPath, ...(item as HeadingItem).fullPath].join(
          '#',
        )
        linkText = `${ctx.fileQuery}#${headingPath}`
      }

      tiptap.chain().focus().insertContentAt({ from, to }, `[[${linkText}#`).run()
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

      const folderPath = item.linkPath.join('/')

      tiptap.chain().focus().insertContentAt({ from, to }, `[[${folderPath}/`).run()
    },
    [editor],
  )

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
              continueLink(selectedItem, context)
            } else if (selectedItem.item.type === SIDEBAR_ITEM_TYPES.folders) {
              continueFolderPath(selectedItem, context)
            } else {
              insertLink(selectedItem, context)
            }
          } else if (context?.mode === 'heading' && headingItems[selectedIndex]) {
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

  if (!editor || !menu.show || !menu.pos || context?.mode === 'display-name') return null

  const isHeading = context?.mode === 'heading'
  const loading = isHeading && headingsQuery.isPending

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: menu.pos.left,
        top: menu.pos.bottom + 4,
        zIndex: 2000,
      }}
    >
      <div className="w-[340px] max-w-[90vw] max-h-80 flex flex-col bg-popover text-popover-foreground rounded-lg shadow-md border border-border text-[13px] overflow-hidden">
        {isHeading && context?.resolvedItem && (
          <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground border-b border-border/50 truncate">
            Headings in &ldquo;{context.resolvedItem.name}&rdquo;
            {context.completedHeadingPath.length > 0 && (
              <span className="text-muted-foreground/70">
                {' '}
                &gt; {context.completedHeadingPath.join(' > ')}
              </span>
            )}
          </div>
        )}
        <ScrollArea className="flex-1 max-h-[calc(320px-32px)]">
          {loading ? (
            <div className="px-3 py-3 text-center text-xs text-muted-foreground">
              Loading headings...
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-muted-foreground">
              {isHeading ? 'No headings found' : 'No matches found'}
            </div>
          ) : isHeading ? (
            <div className="p-0.5" role="listbox">
              {headingItems.map((item, i) => (
                <div
                  key={item.key}
                  ref={i === selectedIndex ? selectedItemRef : undefined}
                  role="option"
                  aria-selected={i === selectedIndex}
                  onClick={() => insertLink(item, context)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`flex items-center justify-between gap-2 px-2 py-1 rounded-sm cursor-default select-none ${
                    i === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                  }`}
                >
                  <span
                    className="font-medium truncate"
                    style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                  >
                    {'#'.repeat(item.level)} {item.title}
                  </span>
                  <span className="shrink-0 h-4 px-1.5 text-[10px] font-medium rounded-sm bg-muted text-muted-foreground border border-border inline-flex items-center">
                    H{item.level}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-0.5" role="listbox">
              {fileItems.map((item, i) => (
                <div key={item.key} ref={i === selectedIndex ? selectedItemRef : undefined}>
                  <SearchResultItem
                    id={item.key}
                    icon={getSidebarItemIcon(item.item)}
                    title={item.title}
                    subtitle={item.subtext || undefined}
                    badge={item.badge}
                    isSelected={i === selectedIndex}
                    onClick={() => insertLink(item, context)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="flex items-center justify-evenly gap-3 px-2 py-1 text-[10px] text-muted-foreground border-t border-border/50">
          {truncatedCount > 0 && <span>+{truncatedCount} more</span>}
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>tab continue</span>
          <span>esc close</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
