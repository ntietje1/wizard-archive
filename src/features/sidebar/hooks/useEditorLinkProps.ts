import type { CampaignSlug } from 'convex/campaigns/validation'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { Username } from 'convex/users/validation'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export const EDITOR_ROUTE = '/campaigns/$dmUsername/$campaignSlug/editor' as const

export interface EditorLinkProps {
  to: typeof EDITOR_ROUTE
  params: { dmUsername: Username; campaignSlug: CampaignSlug }
  search: EditorSearch
}

export function buildEditorLinkProps(
  item: { slug: SidebarItemSlug },
  params: { dmUsername: Username; campaignSlug: CampaignSlug },
): EditorLinkProps {
  return {
    to: EDITOR_ROUTE,
    params,
    search: { item: item.slug },
  }
}

export function useEditorLinkProps(item: { slug: SidebarItemSlug }): EditorLinkProps {
  const { dmUsername, campaignSlug } = useCampaign()

  return buildEditorLinkProps(item, { dmUsername, campaignSlug })
}
