import { useCallback, useMemo } from 'react'
import { normalizeSidebarItemColorOrDefault } from 'shared/sidebar-items/color'
import { isDangerousUrl } from 'shared/links/parsing'
import { resolveParsedItemPath } from 'shared/links/resolution'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import type { ParsedLinkData, ResolvedLink } from 'shared/links/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'

export interface LinkResolver {
  resolveLink: (parsed: ParsedLinkData) => ResolvedLink
  allItems: Array<AnySidebarItem>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
  isViewerMode: boolean
}

const EMPTY_ITEMS: Array<AnySidebarItem> = []

export function useLinkResolver(
  sourceNoteId?: Id<'sidebarItems'>,
  options: { isViewerMode: boolean } = { isViewerMode: false },
): LinkResolver {
  const { data: sidebarItems, itemsMap } = useActiveSidebarItems()
  const { dmUsername, campaignSlug } = useCampaign()

  const allItems = sidebarItems ?? EMPTY_ITEMS
  const { isViewerMode } = options
  const sourceParentId = sourceNoteId ? itemsMap.get(sourceNoteId)?.parentId : undefined

  const resolveLink = useCallback(
    (parsed: ParsedLinkData): ResolvedLink => {
      if (parsed.isExternal) {
        const href = isDangerousUrl(parsed.rawTarget) ? null : parsed.rawTarget
        return {
          ...parsed,
          resolved: true,
          itemId: null,
          href,
          color: null,
        }
      }

      if (!dmUsername || !campaignSlug || parsed.itemPath.length === 0) {
        return {
          ...parsed,
          resolved: false,
          itemId: null,
          href: null,
          color: null,
        }
      }

      const item = resolveParsedItemPath(
        parsed.pathKind,
        parsed.itemPath,
        allItems,
        itemsMap,
        sourceParentId,
      )
      if (!item) {
        return {
          ...parsed,
          resolved: false,
          itemId: null,
          href: null,
          color: null,
        }
      }

      let href = `/campaigns/${dmUsername}/${campaignSlug}/editor?item=${item.slug}`
      if (parsed.headingPath.length > 0) {
        href = `${href}&heading=${encodeURIComponent(parsed.headingPath.join('#'))}`
      }

      return {
        ...parsed,
        resolved: true,
        itemId: item._id,
        href,
        color: normalizeSidebarItemColorOrDefault(item.color),
      }
    },
    [allItems, campaignSlug, dmUsername, itemsMap, sourceParentId],
  )

  return useMemo(
    () => ({ resolveLink, allItems, itemsMap, isViewerMode }),
    [resolveLink, allItems, itemsMap, isViewerMode],
  )
}
