import { useCallback, useEffect, useRef, useState } from 'react'
import { filterSuggestionItems } from '@blocknote/core'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'
import { buildBreadcrumbs, getItemTypeLabel } from '~/lib/sidebar-item-utils'

import { useAllSidebarItems } from '~/hooks/useSidebarItems'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import './wiki-link-autocomplete.css'

interface WikiLinkMenuItem {
  key: string
  title: string
  subtext: string
  badge: string
  item: AnySidebarItem
}

// Regex to find unclosed wiki-link at cursor: [[ followed by valid content
// - Content cannot contain [[ (would look like nested link start)
// - Content cannot contain ]] (would close the link)
// - Single [ or ] are allowed (e.g., [[name] for name "[name]")
const UNCLOSED_WIKI_LINK_REGEX = /\[\[((?:(?!\[\[)(?!\]\]).)*)?$/

/**
 * Check if cursor is inside an unclosed wiki-link pattern.
 * Returns the query string if valid, null otherwise.
 */
function getWikiLinkContext(
  editor: CustomBlockNoteEditor,
): { query: string; startPos: number } | null {
  const tiptapEditor = editor._tiptapEditor
  if (!tiptapEditor) return null

  const { state } = tiptapEditor
  const { from } = state.selection

  // Get text from start of block to cursor
  const $pos = state.selection.$from
  const blockStart = $pos.start()
  const textBeforeCursor = state.doc.textBetween(blockStart, from)

  // Check for unclosed [[ pattern
  const match = UNCLOSED_WIKI_LINK_REGEX.exec(textBeforeCursor)
  if (!match) return null

  // Found [[ - return the query (text after [[)
  const query = match[1] || ''
  const startPos = blockStart + match.index

  return { query, startPos }
}

/**
 * Autocomplete menu for wiki-links.
 * Shows suggestions when typing [[query (no spaces, no closing brackets).
 */
export function WikiLinkAutocomplete({
  editor,
}: {
  editor: CustomBlockNoteEditor | undefined
}) {
  const { data: sidebarItems, itemsMap } = useAllSidebarItems()
  const [menuState, setMenuState] = useState<{
    show: boolean
    query: string
    referencePos: DOMRect | null
  }>({ show: false, query: '', referencePos: null })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [items, setItems] = useState<Array<WikiLinkMenuItem>>([])
  const [isDragging, setIsDragging] = useState(false)
  const hasEditedLinkRef = useRef(false)

  // Build filtered menu items when query changes
  useEffect(() => {
    if (!sidebarItems || !itemsMap || !menuState.show) {
      setItems([])
      return
    }

    const allItems: Array<WikiLinkMenuItem> = sidebarItems.map((item) => ({
      key: item._id,
      title: item.name || defaultItemName(item),
      subtext: buildBreadcrumbs(item, itemsMap),
      badge: getItemTypeLabel(item.type),
      item,
    }))

    const filtered = menuState.query
      ? filterSuggestionItems(allItems, menuState.query)
      : allItems

    setItems(filtered.slice(0, 10))
    setSelectedIndex(0)
  }, [sidebarItems, itemsMap, menuState.show, menuState.query])

  // Track mouse drag state to prevent menu from showing during selection
  useEffect(() => {
    if (!editor) return

    const editorElement = editor.domElement
    if (!editorElement) return

    const handleMouseDown = () => {
      setIsDragging(true)
      setMenuState({ show: false, query: '', referencePos: null })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    editorElement.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      editorElement.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [editor])

  // Listen to editor changes and update menu state
  useEffect(() => {
    if (!editor) return

    const updateMenuState = ({
      transaction,
    }: {
      transaction: { docChanged: boolean }
    }) => {
      // Don't show menu while user is dragging to select text
      if (isDragging) return

      const context = getWikiLinkContext(editor)

      if (context) {
        // Mark as edited if doc changed while in wiki-link context
        if (transaction.docChanged) {
          hasEditedLinkRef.current = true
        }

        // Only show menu if user has edited the link
        if (!hasEditedLinkRef.current) return

        // Get caret position for menu placement
        const tiptapEditor = editor._tiptapEditor
        const coords = tiptapEditor?.view?.coordsAtPos(context.startPos)
        const referencePos = coords
          ? new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top)
          : null

        setMenuState({
          show: true,
          query: context.query,
          referencePos,
        })
      } else {
        // Left wiki-link context, reset edited flag
        hasEditedLinkRef.current = false
        setMenuState({ show: false, query: '', referencePos: null })
      }
    }

    // Subscribe to editor changes
    const tiptapEditor = editor._tiptapEditor
    if (tiptapEditor) {
      tiptapEditor.on('transaction', updateMenuState)
      return () => {
        tiptapEditor.off('transaction', updateMenuState)
      }
    }
  }, [editor, isDragging])

  const insertWikiLink = useCallback(
    (item: WikiLinkMenuItem) => {
      if (!editor) return

      const context = getWikiLinkContext(editor)
      if (!context) return

      const displayName = item.title
      const tiptapEditor = editor._tiptapEditor
      if (!tiptapEditor) return

      const { state } = tiptapEditor
      const from = context.startPos
      const cursorPos = state.selection.from

      // Check for closing brackets after cursor
      // Need to handle cases like ]]] where name ends with ] (e.g., [[name]]])
      const textAfterCursor = state.doc.textBetween(
        cursorPos,
        Math.min(cursorPos + 10, state.doc.content.size),
      )

      // Find the true closing ]] (followed by non-] or end of text)
      let closingBracketsToDelete = 0
      let consecutiveBrackets = 0
      for (let i = 0; i < textAfterCursor.length; i++) {
        if (textAfterCursor[i] === ']') {
          consecutiveBrackets++
          // Check if we have at least ]] and next char is not ]
          if (consecutiveBrackets >= 2) {
            const nextChar = textAfterCursor[i + 1]
            if (nextChar === undefined || nextChar !== ']') {
              closingBracketsToDelete = consecutiveBrackets
              break
            }
          }
        } else {
          consecutiveBrackets = 0
        }
      }

      const to = cursorPos + closingBracketsToDelete

      tiptapEditor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent(`[[${displayName}]]`)
        .run()

      setMenuState({ show: false, query: '', referencePos: null })
    },
    [editor],
  )

  // Handle keyboard navigation and selection
  useEffect(() => {
    if (!editor || !menuState.show) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!menuState.show) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1))
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex(
            (i) =>
              (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1),
          )
          break
        case 'Enter':
          event.preventDefault()
          if (items[selectedIndex]) {
            insertWikiLink(items[selectedIndex])
          }
          break
        case 'Tab':
        case 'Escape':
          event.preventDefault()
          setMenuState({ show: false, query: '', referencePos: null })
          break
      }
    }

    const editorElement = editor.domElement
    if (editorElement) {
      editorElement.addEventListener('keydown', handleKeyDown, true)
      return () => {
        editorElement.removeEventListener('keydown', handleKeyDown, true)
      }
    }
  }, [editor, menuState.show, items, selectedIndex, insertWikiLink])

  if (!editor || !menuState.show || !menuState.referencePos) return null

  return (
    <div
      className="wiki-link-menu-container"
      style={{
        position: 'fixed',
        left: menuState.referencePos.left,
        top: menuState.referencePos.bottom + 4,
        zIndex: 2000,
      }}
    >
      <div className="wiki-link-menu">
        <ScrollArea className="wiki-link-menu-scroll-area">
          {items.length === 0 ? (
            <div className="wiki-link-menu-empty">No matches found</div>
          ) : (
            <div className="wiki-link-menu-items">
              {items.map((item, index) => (
                <div
                  key={item.key}
                  onClick={() => insertWikiLink(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`wiki-link-menu-item ${
                    index === selectedIndex ? 'selected' : ''
                  }`}
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
          <span>tab close</span>
        </div>
      </div>
    </div>
  )
}
