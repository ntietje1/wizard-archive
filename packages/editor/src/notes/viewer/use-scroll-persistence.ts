import type { ResourceId } from '../../resources/domain-id'
import { useEffect, useRef } from 'react'

export interface NoteScrollStore {
  loadNoteScrollTop: (noteId: ResourceId) => number
  saveNoteScrollTop: (noteId: ResourceId, scrollTop: number) => void
}

export function useScrollPersistence(
  itemId: ResourceId,
  viewport: HTMLDivElement | null,
  scrollStore: NoteScrollStore,
  skipRestore?: boolean,
) {
  const lastRestoredItemRef = useRef<string | null>(null)

  useEffect(() => {
    if (skipRestore) return
    if (lastRestoredItemRef.current === itemId) return

    if (!viewport) return

    lastRestoredItemRef.current = itemId

    const savedPosition = scrollStore.loadNoteScrollTop(itemId)
    if (savedPosition != null && savedPosition > 0) {
      requestAnimationFrame(() => {
        viewport.scrollTop = savedPosition
      })
    }
  }, [itemId, scrollStore, skipRestore, viewport])

  useEffect(() => {
    if (!viewport) return

    let timeoutId: ReturnType<typeof setTimeout>

    const handleScroll = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        scrollStore.saveNoteScrollTop(itemId, viewport.scrollTop)
      }, 150)
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', handleScroll)
      clearTimeout(timeoutId)
    }
  }, [itemId, scrollStore, viewport])
}
