import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'
import { readPersistedJson, writePersistedJson } from '~/shared/storage/persisted-storage'

const SCROLL_POSITIONS_KEY = 'note-scroll-positions'
const MAX_SCROLL_ENTRIES = 200

interface ScrollEntry {
  scrollTop: number
  lastAccess: number
}

function parseScrollEntry(value: unknown): ScrollEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const scrollTop = (value as { scrollTop?: unknown }).scrollTop
  const lastAccess = (value as { lastAccess?: unknown }).lastAccess
  if (typeof scrollTop !== 'number') return null
  return {
    scrollTop,
    lastAccess: typeof lastAccess === 'number' ? lastAccess : 0,
  }
}

function parseScrollPositions(value: unknown): Record<string, ScrollEntry> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}

  const positions: Record<string, ScrollEntry> = {}
  for (const [key, rawEntry] of Object.entries(value)) {
    const entry = parseScrollEntry(rawEntry)
    if (entry) positions[key] = entry
  }
  return positions
}

function getScrollPositions(): Record<string, ScrollEntry> {
  return readPersistedJson(SCROLL_POSITIONS_KEY, {}, parseScrollPositions)
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

    writePersistedJson(SCROLL_POSITIONS_KEY, positions)
  } catch {
    // ignore
  }
}

export function useScrollPersistence(
  itemId: string,
  viewportRef: RefObject<HTMLDivElement | null>,
  skipRestore?: boolean,
) {
  const lastRestoredItemRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastRestoredItemRef.current === itemId || skipRestore) {
      lastRestoredItemRef.current = itemId
      return
    }

    const viewport = viewportRef.current
    if (!viewport) return

    lastRestoredItemRef.current = itemId

    const savedEntry = getScrollPositions()[itemId]
    const savedPosition = savedEntry?.scrollTop
    if (savedPosition != null && savedPosition > 0) {
      requestAnimationFrame(() => {
        viewport.scrollTop = savedPosition
      })
    }
  }, [itemId, skipRestore, viewportRef])

  useEffect(() => {
    const viewport = viewportRef.current
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
  }, [itemId, viewportRef])
}
