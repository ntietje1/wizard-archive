import { useEffect } from 'react'
import { useMatch } from '@tanstack/react-router'
import { useShallow } from 'zustand/shallow'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { SidebarItemType } from 'convex/sidebarItems/baseTypes'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { getTypeAndSlug } from '~/lib/sidebar-item-utils'

interface TypeAndSlug {
  type: SidebarItemType
  slug: string
}

/**
 * Renders once near the top of the editor tree to sync the URL-based
 * selection into the store. Must be rendered as a component,
 * not called in every sidebar item.
 */
export function useSelectedItemSync() {
  const editorMatch = useMatch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}
  const typeAndSlug = getTypeAndSlug(editorSearch)

  useEffect(() => {
    const setSelected = useSidebarUIStore.getState().setSelected
    if (typeAndSlug) {
      setSelected(typeAndSlug.type, typeAndSlug.slug)
    } else {
      setSelected(null, null)
    }
  }, [typeAndSlug])

  return typeAndSlug
}

/**
 * Efficient per-item hook that only re-renders when the `isSelected` boolean
 * changes for THIS specific item.
 */
export function useIsSelectedItem(item: AnySidebarItem): boolean {
  const itemType = item.type
  const itemSlug = item.slug
  return useSidebarUIStore(
    (s) => s.selectedType === itemType && s.selectedSlug === itemSlug,
  )
}

/**
 * Returns the currently selected type+slug from the store.
 * Only re-renders when the selection changes.
 */
export function useSelectedTypeAndSlug(): TypeAndSlug | null {
  return useSidebarUIStore(
    useShallow((s) =>
      s.selectedType && s.selectedSlug
        ? { type: s.selectedType, slug: s.selectedSlug }
        : null,
    ),
  )
}

/**
 * Non-reactive getter for the current selection. Does NOT subscribe to changes.
 * Use this when you need the current value at call time without triggering re-renders.
 */
export function getSelectedTypeAndSlug(): TypeAndSlug | null {
  const s = useSidebarUIStore.getState()
  return s.selectedType && s.selectedSlug
    ? { type: s.selectedType, slug: s.selectedSlug }
    : null
}
