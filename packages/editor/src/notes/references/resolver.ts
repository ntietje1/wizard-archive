import { isDangerousUrl } from '../../../../../shared/links/parsing'
import type { AnyItem } from '../../workspace/items'
import { normalizeSidebarItemColorOrDefault } from '../../workspace/items/appearance'
import type { ParsedLinkData, ResolvedLink } from '../../../../../shared/links/types'
export interface LinkResolver {
  revision: string
  resolveLink: (parsed: ParsedLinkData) => ResolvedLink
  isViewerMode: boolean
}

interface LinkResolverSource {
  isViewerMode: boolean
  revision: string
  resolveItemPath: (parsed: ParsedLinkData) => AnyItem | null
}

export function createLinkResolver({
  isViewerMode,
  revision,
  resolveItemPath,
}: LinkResolverSource): LinkResolver {
  const resolveLink = (parsed: ParsedLinkData): ResolvedLink => {
    if (parsed.isExternal) {
      const rejected = isDangerousUrl(parsed.rawTarget)
      return {
        ...parsed,
        status: rejected ? 'rejected' : 'resolved',
        rejectionReason: rejected ? 'dangerous_url' : null,
        itemId: null,
        href: rejected ? null : parsed.rawTarget,
        color: null,
      }
    }

    if (parsed.itemPath.length === 0 && parsed.headingPath.length === 0) {
      return {
        ...parsed,
        status: 'unresolved',
        rejectionReason: null,
        itemId: null,
        href: null,
        color: null,
      }
    }

    const item = resolveItemPath(parsed)
    if (!item) {
      return {
        ...parsed,
        status: 'unresolved',
        rejectionReason: null,
        itemId: null,
        href: null,
        color: null,
      }
    }

    return {
      ...parsed,
      status: 'resolved',
      rejectionReason: null,
      itemId: item.id,
      href: null,
      color: normalizeSidebarItemColorOrDefault(item.color),
    }
  }

  return { resolveLink, isViewerMode, revision }
}
