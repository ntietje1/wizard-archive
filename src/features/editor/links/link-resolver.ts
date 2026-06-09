import { isDangerousUrl } from 'shared/links/parsing'
import { resolveParsedItemPath } from 'shared/links/resolution'
import { normalizeSidebarItemColorOrDefault } from 'shared/sidebar-items/color'
import type { Id } from 'convex/_generated/dataModel'
import type { ParsedLinkData, ResolvedLink } from 'shared/links/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'

export interface LinkResolver {
  resolveLink: (parsed: ParsedLinkData) => ResolvedLink
  allItems: Array<AnySidebarItem>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
  isViewerMode: boolean
}

interface LinkResolverSource {
  allItems: Array<AnySidebarItem>
  getInternalHref?: (item: AnySidebarItem, parsed: ParsedLinkData) => string | null
  isViewerMode: boolean
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
  sourceNoteId?: Id<'sidebarItems'>
}

export function createLinkResolver({
  allItems,
  getInternalHref,
  isViewerMode,
  itemsMap,
  sourceNoteId,
}: LinkResolverSource): LinkResolver {
  const sourceParentId = sourceNoteId ? itemsMap.get(sourceNoteId)?.parentId : undefined
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

    if (!getInternalHref || parsed.itemPath.length === 0) {
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

    const href = getInternalHref(item, parsed)
    if (!href) {
      return {
        ...parsed,
        resolved: false,
        itemId: null,
        href: null,
        color: null,
      }
    }

    return {
      ...parsed,
      resolved: true,
      itemId: item._id,
      href,
      color: normalizeSidebarItemColorOrDefault(item.color),
    }
  }

  return { resolveLink, allItems, itemsMap, isViewerMode }
}
