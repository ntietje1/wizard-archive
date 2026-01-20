import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { filterSuggestionItems } from '@blocknote/core'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import type { CustomBlock, CustomBlockNoteEditor } from '~/lib/editor-schema'
import type { HeadingEntry } from '~/lib/heading-utils'
import { buildBreadcrumbs, getItemTypeLabel } from '~/lib/sidebar-item-utils'
import { extractHeadingsFromContent } from '~/lib/heading-utils'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'
import { useCampaign } from '~/hooks/useCampaign'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import './wiki-link-autocomplete.css'

type AutocompleteMode = 'file' | 'heading' | 'display-name'

interface FileItem {
  key: SidebarItemId
  title: string
  subtext: string
  badge: string
  item: AnySidebarItem
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
  fileQuery: string
  headingQuery: string
  completedHeadingPath: Array<string>
  resolvedItem: AnySidebarItem | null
}

// Match unclosed wiki-link at cursor: [[ followed by content (no [[ or ]])
const UNCLOSED_WIKI_LINK_REGEX = /\[\[((?:(?!\[\[)(?!\]\]).)*)?$/

function getAutocompleteContext(
  query: string,
  itemsByName: Map<string, AnySidebarItem>,
): AutocompleteContext {
  if (query.includes('|')) {
    return {
      mode: 'display-name',
      fileQuery: '',
      headingQuery: '',
      completedHeadingPath: [],
      resolvedItem: null,
    }
  }

  const hashIdx = query.indexOf('#')
  if (hashIdx === -1) {
    return {
      mode: 'file',
      fileQuery: query,
      headingQuery: '',
      completedHeadingPath: [],
      resolvedItem: null,
    }
  }

  const fileName = query.slice(0, hashIdx)
  const item = itemsByName.get(fileName.toLowerCase())

  // Only notes support heading links
  if (!item || item.type !== SIDEBAR_ITEM_TYPES.notes) {
    return {
      mode: 'file',
      fileQuery: query,
      headingQuery: '',
      completedHeadingPath: [],
      resolvedItem: null,
    }
  }

  const parts = query.slice(hashIdx + 1).split('#')
  return {
    mode: 'heading',
    fileQuery: fileName,
    headingQuery: parts.at(-1) || '',
    completedHeadingPath: parts.slice(0, -1),
    resolvedItem: item,
  }
}

function getWikiLinkContext(
  editor: CustomBlockNoteEditor,
): { query: string; startPos: number } | null {
  const tiptap = editor._tiptapEditor
  if (!tiptap) return null
  const { state } = tiptap
  const $pos = state.selection.$from
  const text = state.doc.textBetween($pos.start(), state.selection.from)
  const match = UNCLOSED_WIKI_LINK_REGEX.exec(text)
  if (!match) return null
  return { query: match[1] || '', startPos: $pos.start() + match.index }
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
    return items.filter((i) => i.title.toLowerCase().includes(q)).slice(0, 10)
  }
  return items.slice(0, 10)
}

export function WikiLinkAutocomplete({
  editor,
}: {
  editor: CustomBlockNoteEditor | undefined
}) {
  const { data: sidebarItems, itemsMap } = useAllSidebarItems()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

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

  const itemsByName = useMemo(() => {
    const map = new Map<string, AnySidebarItem>()
    sidebarItems?.forEach((item) => {
      if (item.name) map.set(item.name.toLowerCase(), item)
    })
    return map
  }, [sidebarItems])

  const context = useMemo(
    () => (menu.show ? getAutocompleteContext(menu.query, itemsByName) : null),
    [menu, itemsByName],
  )

  // Fetch note content for heading mode
  const noteId =
    context?.mode === 'heading' &&
    context.resolvedItem?.type === SIDEBAR_ITEM_TYPES.notes
      ? context.resolvedItem._id
      : undefined

  const noteQuery = useQuery({
    ...convexQuery(
      api.notes.queries.getNoteWithContent,
      noteId && campaignId ? { noteId } : 'skip',
    ),
    staleTime: 30000,
  })

  const headings = useMemo(() => {
    if (!noteQuery.data?.content) return []
    return extractHeadingsFromContent(
      noteQuery.data.content as Array<CustomBlock>,
    )
  }, [noteQuery.data?.content])

  // Build filtered items
  const fileItems = useMemo((): Array<FileItem> => {
    if (!sidebarItems || !itemsMap || context?.mode !== 'file') return []
    const all = sidebarItems.map((item) => ({
      key: item._id,
      title: item.name || defaultItemName(item),
      subtext: buildBreadcrumbs(item, itemsMap),
      badge: getItemTypeLabel(item.type),
      item,
    }))
    const filtered = context.fileQuery
      ? filterSuggestionItems(all, context.fileQuery)
      : all
    return filtered.slice(0, 10)
  }, [sidebarItems, itemsMap, context?.mode, context?.fileQuery])

  const headingItems = useMemo((): Array<HeadingItem> => {
    if (context?.mode !== 'heading') return []
    return buildHeadingItems(
      headings,
      context.completedHeadingPath,
      context.headingQuery,
    )
  }, [
    context?.mode,
    context?.completedHeadingPath,
    context?.headingQuery,
    headings,
  ])

  const items = context?.mode === 'heading' ? headingItems : fileItems

  // Reset selection on mode/path change
  const completedHeadingPath = context?.completedHeadingPath?.join('#')
  useEffect(() => {
    setSelectedIndex(0)
  }, [context?.mode, completedHeadingPath])

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

      const { state } = tiptap
      const from = wikiCtx.startPos
      const cursor = state.selection.from

      // Find closing ]] after cursor
      const after = state.doc.textBetween(
        cursor,
        Math.min(cursor + 10, state.doc.content.size),
      )
      let closingLen = 0,
        brackets = 0
      for (let i = 0; i < after.length; i++) {
        if (after[i] === ']') {
          brackets++
          if (
            brackets >= 2 &&
            (after[i + 1] === undefined || after[i + 1] !== ']')
          ) {
            closingLen = brackets
            break
          }
        } else brackets = 0
      }

      const to = cursor + closingLen
      const text =
        ctx.mode === 'file'
          ? `[[${(item as FileItem).title}]]`
          : `[[${ctx.fileQuery}#${[...ctx.completedHeadingPath, ...(item as HeadingItem).fullPath].join('#')}]]`

      tiptap.chain().focus().deleteRange({ from, to }).insertContent(text).run()
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
      const cursor = tiptap.state.selection.from
      const text =
        ctx.mode === 'file'
          ? `[[${(item as FileItem).title}#`
          : `[[${ctx.fileQuery}#${[...ctx.completedHeadingPath, ...(item as HeadingItem).fullPath].join('#')}#`

      tiptap
        .chain()
        .focus()
        .deleteRange({ from, to: cursor })
        .insertContent(text)
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
            if (
              fileItems[selectedIndex].item.type === SIDEBAR_ITEM_TYPES.notes
            ) {
              continueLink(fileItems[selectedIndex], context)
            } else {
              insertLink(fileItems[selectedIndex], context)
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
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>tab continue</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
