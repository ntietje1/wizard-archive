import { useMemo } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { useCampaign } from './useCampaign'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { EditorSearch } from '~/components/notes-page/validate-search'

export const EDITOR_ROUTE =
  '/campaigns/$dmUsername/$campaignSlug/editor' as const

export interface EditorLinkProps {
  to: typeof EDITOR_ROUTE
  params: { dmUsername: string; campaignSlug: string }
  search: EditorSearch
}

function itemTypeToSearchKey(
  type: SidebarItemType,
): keyof Pick<EditorSearch, 'note' | 'map' | 'folder' | 'file'> {
  switch (type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return 'note'
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return 'map'
    case SIDEBAR_ITEM_TYPES.folders:
      return 'folder'
    case SIDEBAR_ITEM_TYPES.files:
      return 'file'
  }
}

export function buildEditorLinkProps(
  item: { type: SidebarItemType; slug: string },
  params: { dmUsername: string; campaignSlug: string },
): EditorLinkProps {
  const key = itemTypeToSearchKey(item.type)
  return {
    to: EDITOR_ROUTE,
    params,
    search: { [key]: item.slug },
  }
}

export function useEditorLinkProps(item: {
  type: SidebarItemType
  slug: string
}): EditorLinkProps {
  const { dmUsername, campaignSlug } = useCampaign()

  return useMemo(
    () => buildEditorLinkProps(item, { dmUsername, campaignSlug }),
    [item.type, item.slug, dmUsername, campaignSlug],
  )
}
