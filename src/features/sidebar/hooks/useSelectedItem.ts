import { useEffect } from 'react'
import { useMatch } from '@tanstack/react-router'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { getSlug } from '~/features/sidebar/utils/sidebar-item-utils'

export function useSelectedItemSync() {
  const editorMatch = useMatch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}
  const slug = getSlug(editorSearch)

  useEffect(() => {
    useSidebarUIStore.getState().setSelected(slug)
  }, [slug])

  return slug
}

export function useIsSelectedItem(item: AnySidebarItem): boolean {
  const itemSlug = item.slug
  return useSidebarUIStore((s) => s.selectedSlug === itemSlug)
}

export function getSelectedSlug(): string | null {
  return useSidebarUIStore.getState().selectedSlug
}
