import { useContext } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { assertNever } from '~/shared/utils/utils'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import {
  SIDEBAR_ITEMS_VIEW,
  SidebarItemsContext,
} from '~/features/sidebar/contexts/sidebar-items-context'
import type {
  SidebarItemsContextValue,
  SidebarItemsValue,
  SidebarItemsView,
} from '~/features/sidebar/contexts/sidebar-items-context'

function useSidebarItemQuery(view: SidebarItemsView): SidebarItemsValue {
  const { campaignId } = useCampaign()
  const query = (() => {
    switch (view) {
      case SIDEBAR_ITEMS_VIEW.active:
        return api.sidebarItems.queries.getActiveSidebarItems
      case SIDEBAR_ITEMS_VIEW.trash:
        return api.sidebarItems.queries.getTrashedSidebarItems
      default:
        return assertNever(view)
    }
  })()

  const result = useAuthQuery(query, campaignId ? { campaignId } : 'skip', {
    placeholderData: keepPreviousData,
  })

  const data: Array<AnySidebarItem> = result.data ?? []

  return {
    data,
    status: result.status,
    error: result.error,
    refetch: result.refetch,
    ...buildSidebarItemMaps(data),
  }
}

export const useSidebarItemsQueries = (): SidebarItemsContextValue => {
  const active = useSidebarItemQuery(SIDEBAR_ITEMS_VIEW.active)
  const trash = useSidebarItemQuery(SIDEBAR_ITEMS_VIEW.trash)
  return { active, trash }
}

// ---------------------------------------------------------------------------
// Consumer hooks
// ---------------------------------------------------------------------------

const useSidebarItems = (view: SidebarItemsView): SidebarItemsValue => {
  const ctx = useContext(SidebarItemsContext)
  if (!ctx) {
    throw new Error('useSidebarItems must be used within a SidebarItemsProvider')
  }
  return ctx[view]
}

export const useActiveSidebarItems = (): SidebarItemsValue =>
  useSidebarItems(SIDEBAR_ITEMS_VIEW.active)

export const useTrashSidebarItems = (): SidebarItemsValue =>
  useSidebarItems(SIDEBAR_ITEMS_VIEW.trash)
