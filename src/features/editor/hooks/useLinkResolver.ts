import { isDangerousUrl } from 'convex/links/linkParsers'
import { resolveItemByPath } from 'convex/links/linkResolution'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { validateHexColorOrDefault } from '~/features/sidebar/utils/sidebar-item-utils'
import type { ParsedLinkData, ResolvedLink } from 'convex/links/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'

export interface LinkResolver {
  resolveLink: (parsed: ParsedLinkData) => ResolvedLink
  allItems: Array<AnySidebarItem>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
  isViewerMode: boolean
}

const EMPTY_ITEMS: Array<AnySidebarItem> = []

export function useLinkResolver(): LinkResolver {
  const { data: sidebarItems, itemsMap } = useActiveSidebarItems()
  const { dmUsername, campaignSlug } = useCampaign()
  const { editorMode, viewAsPlayerId } = useEditorMode()

  const allItems = sidebarItems ?? EMPTY_ITEMS
  const isViewerMode = editorMode === 'viewer' || viewAsPlayerId !== undefined

  const resolveLink = (parsed: ParsedLinkData): ResolvedLink => {
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

    const item = resolveItemByPath(parsed.itemPath, allItems, itemsMap)
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
      color: validateHexColorOrDefault(item.color),
    }
  }

  return { resolveLink, allItems, itemsMap, isViewerMode }
}
