import { useEffect, useSyncExternalStore } from 'react'
import { useMatch } from '@tanstack/react-router'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { getTypeAndSlug } from '~/lib/sidebar-item-utils'
import type { SidebarItemType } from 'convex/sidebarItems/baseTypes'

interface TypeAndSlug {
  type: SidebarItemType
  slug: string
}

// Simple external store for selected type+slug
let selectedTypeSlug: TypeAndSlug | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setSelected(ts: TypeAndSlug | null) {
  if (
    selectedTypeSlug?.type === ts?.type &&
    selectedTypeSlug?.slug === ts?.slug
  ) {
    return
  }
  selectedTypeSlug = ts
  listeners.forEach((l) => l())
}

function getSnapshot() {
  return selectedTypeSlug
}

/**
 * Renders once near the top of the editor tree to sync the URL-based
 * selection into the external store. Must be rendered as a component,
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
    setSelected(typeAndSlug)
  }, [typeAndSlug?.type, typeAndSlug?.slug])

  return typeAndSlug
}

/**
 * Efficient per-item hook that only re-renders when the `isSelected` boolean
 * changes for THIS specific item. Uses useSyncExternalStore for fine-grained
 * subscriptions — on navigation, only 2 items re-render (old + new selection).
 */
export function useIsSelectedItem(item: AnySidebarItem): boolean {
  const itemType = item.type
  const itemSlug = item.slug

  return useSyncExternalStore(subscribe, () => {
    const s = getSnapshot()
    if (!s) return false
    return s.type === itemType && s.slug === itemSlug
  })
}

/**
 * Returns the currently selected type+slug from the external store.
 * Only re-renders when the selection changes.
 */
export function useSelectedTypeAndSlug(): TypeAndSlug | null {
  return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * Non-reactive getter for the current selection. Does NOT subscribe to changes.
 * Use this when you need the current value at call time without triggering re-renders.
 */
export function getSelectedTypeAndSlug(): TypeAndSlug | null {
  return getSnapshot()
}
