import { useEffect, useRef } from 'react'
import type { SidebarItemId } from '../../../../../shared/common/ids'

export interface NoteScrollStore {
  loadNoteScrollTop: (noteId: SidebarItemId) => number
  saveNoteScrollTop: (noteId: SidebarItemId, scrollTop: number) => void
}

export function useScrollPersistence(
  itemId: SidebarItemId,
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
