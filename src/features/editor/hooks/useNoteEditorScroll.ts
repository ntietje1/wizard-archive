import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import {
  extractHeadingsFromContent,
  resolveHeadingPath,
} from '~/features/editor/utils/heading-utils'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

const EDITOR_ROUTE = '/campaigns/$dmUsername/$campaignSlug/editor' as const
const SCROLL_POSITIONS_KEY = 'note-scroll-positions'
const MAX_SCROLL_ENTRIES = 200

interface ScrollEntry {
  scrollTop: number
  lastAccess: number
}

function getScrollPositions(): Record<string, ScrollEntry> {
  try {
    return JSON.parse(localStorage.getItem(SCROLL_POSITIONS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveScrollPosition(itemId: string, scrollTop: number) {
  try {
    const positions = getScrollPositions()
    positions[itemId] = { scrollTop, lastAccess: Date.now() }

    const keys = Object.keys(positions)
    if (keys.length > MAX_SCROLL_ENTRIES) {
      const sorted = keys.sort(
        (a, b) => (positions[a].lastAccess ?? 0) - (positions[b].lastAccess ?? 0),
      )
      for (const key of sorted.slice(0, keys.length - MAX_SCROLL_ENTRIES)) {
        delete positions[key]
      }
    }

    localStorage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify(positions))
  } catch {
    // ignore
  }
}

export function useNoteEditorScroll(itemId: string, content: Array<CustomBlock> | undefined) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const { editorSearch } = useCurrentItem()
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()
  const editor = useNoteEditorStore((s) => s.editor)
  const lastScrolledRef = useRef<string | null>(null)

  const hasHeadingParam = Boolean(editorSearch.heading)

  useEffect(() => {
    const { heading, ...restSearch } = editorSearch
    if (!heading || !content) {
      if (!heading) lastScrolledRef.current = null
      return
    }
    if (lastScrolledRef.current === heading) return

    const headingPath = heading.split('#').filter(Boolean)
    if (headingPath.length === 0) return

    const headings = extractHeadingsFromContent(content)
    const target = resolveHeadingPath(headings, headingPath)
    if (!target) return

    lastScrolledRef.current = heading

    requestAnimationFrame(() => {
      const escapedId = CSS.escape(target.blockNoteId)
      document.querySelector(`[data-id="${escapedId}"]`)?.scrollIntoView({ block: 'start' })

      void navigate({
        to: EDITOR_ROUTE,
        params: { dmUsername, campaignSlug },
        search: restSearch,
        replace: true,
      })

      requestAnimationFrame(() => {
        if (!editor?._tiptapEditor?.view) return
        try {
          editor.focus()
          editor.setTextCursorPosition(target.blockNoteId, 'end')
        } catch {
          // Block might not exist yet or position out of range
        }
      })
    })
  }, [editorSearch, content, navigate, editor, dmUsername, campaignSlug])

  const lastRestoredItemRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastRestoredItemRef.current === itemId || hasHeadingParam) {
      lastRestoredItemRef.current = itemId
      return
    }

    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return

    lastRestoredItemRef.current = itemId

    const savedEntry = getScrollPositions()[itemId]
    const savedPosition = savedEntry?.scrollTop
    if (savedPosition != null && savedPosition > 0) {
      requestAnimationFrame(() => {
        viewport.scrollTop = savedPosition
      })
    }
  }, [itemId, hasHeadingParam])

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return

    let timeoutId: ReturnType<typeof setTimeout>

    const handleScroll = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        saveScrollPosition(itemId, viewport.scrollTop)
      }, 150)
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', handleScroll)
      clearTimeout(timeoutId)
    }
  }, [itemId])

  return { scrollAreaRef }
}
