import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export const EDITOR_ROUTE = '/campaigns/$dmUsername/$campaignSlug/editor' as const

export interface EditorLinkProps {
  to: typeof EDITOR_ROUTE
  params: { dmUsername: string; campaignSlug: string }
  search: EditorSearch
}

export function buildEditorLinkProps(
  item: { slug: string },
  params: { dmUsername: string; campaignSlug: string },
): EditorLinkProps {
  return {
    to: EDITOR_ROUTE,
    params,
    search: { item: item.slug },
  }
}

export function useEditorLinkProps(item: { slug: string }): EditorLinkProps {
  const { dmUsername, campaignSlug } = useCampaign()

  return buildEditorLinkProps(item, { dmUsername, campaignSlug })
}
