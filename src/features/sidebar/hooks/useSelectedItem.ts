import { useEffect } from 'react'
import { useMatch } from '@tanstack/react-router'
import { useShallow } from 'zustand/shallow'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useCutFileSystemItemIds } from '~/features/filesystem/filesystem-clipboard-store'
import { getSidebarItemVisualState } from '~/features/sidebar/utils/sidebar-item-visual-state'
import { getSlug } from '~/features/sidebar/utils/sidebar-item-utils'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { addRecentItem } from '~/features/search/hooks/use-recent-items'

const EMPTY_CUT_ITEM_IDS: ReadonlyArray<AnySidebarItem['_id']> = []

export function useSelectedItemSync() {
  const editorMatch = useMatch({
    from: '/_app/_authed/campaigns/$dmUsername/$campaignSlug/editor',
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}
  const slug = getSlug(editorSearch)
  const { campaignId } = useCampaign()

  useEffect(() => {
    useSidebarUIStore.getState().setSelected(slug)
  }, [slug])

  useEffect(() => {
    if (slug && campaignId) addRecentItem(campaignId, slug)
  }, [slug, campaignId])

  return slug
}

export function useSidebarItemVisualState(item: AnySidebarItem) {
  const cutItemIds = useCutFileSystemItemIds()
  const selection = useSidebarUIStore(
    useShallow((s) => ({
      selectedItemIds: s.selectedItemIds,
      selectedSlug: s.selectedSlug,
    })),
  )
  return getSidebarItemVisualState({
    item,
    selectedItemIds: selection.selectedItemIds,
    selectedSlug: selection.selectedSlug,
    cutItemIds: cutItemIds ?? EMPTY_CUT_ITEM_IDS,
  })
}

export function useIsFocusedItem(item: AnySidebarItem): boolean {
  const focusedItemId = useSidebarUIStore((s) => s.focusedItemId)
  return focusedItemId === item._id
}

export function getSelectedSlug(): SidebarItemSlug | null {
  return useSidebarUIStore.getState().selectedSlug
}
