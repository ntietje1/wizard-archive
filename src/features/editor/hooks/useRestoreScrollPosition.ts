import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import usePersistedState from '~/shared/hooks/usePersistedState'

const SCROLL_POSITIONS_KEY = 'note-scroll-positions'

type ScrollPositions = Record<string, number>

/**
 * Persists and restores scroll position per item.
 */
export function useRestoreScrollPosition(
  itemId: string,
  scrollAreaRef: RefObject<HTMLElement | null>,
  skipRestore = false,
) {
  const [scrollPositions, setScrollPositions] = usePersistedState<ScrollPositions>(
    SCROLL_POSITIONS_KEY,
    {},
  )
  const hasRestoredRef = useRef(false)
  const itemIdRef = useRef(itemId)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Reset flag when item changes
  if (itemIdRef.current !== itemId) {
    itemIdRef.current = itemId
    hasRestoredRef.current = false
  }

  // Wait for usePersistedState to load from localStorage
  useEffect(() => {
    setHasInitialized(true)
  }, [])

  // Restore scroll position on load
  useEffect(() => {
    if (!hasInitialized || hasRestoredRef.current) return

    // If another scroll behavior is active, mark as handled and skip
    if (skipRestore) {
      hasRestoredRef.current = true
      return
    }

    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return

    const savedPosition = scrollPositions[itemId]
    hasRestoredRef.current = true

    if (savedPosition != null && savedPosition > 0) {
      requestAnimationFrame(() => {
        viewport.scrollTop = savedPosition
      })
    }
  }, [hasInitialized, itemId, scrollPositions, skipRestore, scrollAreaRef])

  // Save scroll position on scroll
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return

    let timeoutId: ReturnType<typeof setTimeout>

    const handleScroll = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setScrollPositions((prev) => ({
          ...prev,
          [itemId]: viewport.scrollTop,
        }))
      }, 150)
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', handleScroll)
      clearTimeout(timeoutId)
    }
  }, [itemId, setScrollPositions, scrollAreaRef])
}
