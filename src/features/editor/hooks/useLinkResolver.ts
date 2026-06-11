import { useMemo } from 'react'
import { createLinkResolver } from '../links/link-resolver'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useFilteredSidebarItems'
import type { Id } from 'convex/_generated/dataModel'
import type { ParsedLinkData } from 'shared/links/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { LinkResolver } from '../links/link-resolver'

const EMPTY_ITEMS: Array<AnySidebarItem> = []

export function useLinkResolver(
  sourceNoteId?: Id<'sidebarItems'>,
  options: { isViewerMode: boolean } = { isViewerMode: false },
): LinkResolver {
  const { data: sidebarItems, itemsMap } = useFilteredSidebarItems()
  const { dmUsername, campaignSlug } = useCampaign()

  const allItems = sidebarItems ?? EMPTY_ITEMS
  const { isViewerMode } = options

  return useMemo(() => {
    const getInternalHref =
      dmUsername && campaignSlug
        ? (item: AnySidebarItem, parsed: ParsedLinkData) => {
            let href = `/campaigns/${dmUsername}/${campaignSlug}/editor?item=${item.slug}`
            if (parsed.headingPath.length > 0) {
              href = `${href}&heading=${encodeURIComponent(parsed.headingPath.join('#'))}`
            }
            return href
          }
        : undefined

    return createLinkResolver({
      allItems,
      getInternalHref,
      isViewerMode,
      itemsMap,
      sourceNoteId,
    })
  }, [allItems, campaignSlug, dmUsername, isViewerMode, itemsMap, sourceNoteId])
}
