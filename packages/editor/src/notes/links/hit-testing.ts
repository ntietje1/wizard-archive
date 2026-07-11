import type { LinkPathKind } from '../../../../../shared/links/types'
import { LINK_ROLE } from './decoration'
import type { LinkStatus, LinkType } from './decoration'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { ResourceSlug } from '../../workspace/resource-contract'

interface ParsedLinkElement {
  element: Element
  exists: boolean
  pathKind: LinkPathKind
  itemPath: Array<string>
  itemName: string | null
  itemId: SidebarItemId | null
  itemSlug: ResourceSlug | null
  href: string | null
  heading: string | null
  type: LinkType
  status: LinkStatus
}

const GENERIC_LINK_SELECTOR = Object.values(LINK_ROLE)
  .map((role) => `[data-link-role="${role}"]`)
  .join(', ')

function getValidLinkType(type: string | null): LinkType | null {
  switch (type) {
    case 'wiki':
    case 'md-internal':
    case 'md-external':
      return type
    default:
      return null
  }
}

function getValidPathKind(type: LinkType, pathKind: string | null): LinkPathKind | null {
  if (type === 'md-external') return 'global'

  switch (pathKind) {
    case 'global':
    case 'relative':
      return pathKind
    default:
      return null
  }
}

function getValidLinkStatus(status: string | null): LinkStatus | null {
  switch (status) {
    case 'exists':
    case 'external':
    case 'ghost':
    case 'rejected':
      return status
    default:
      return null
  }
}

function parseLinkElement(linkEl: Element): ParsedLinkElement | null {
  const type = getValidLinkType(linkEl.getAttribute('data-link-type'))
  if (!type) return null
  const pathKind = getValidPathKind(type, linkEl.getAttribute('data-link-path-kind'))
  if (!pathKind) return null
  const status = getValidLinkStatus(linkEl.getAttribute('data-link-status'))
  if (!status) return null

  const itemPath = linkEl
    .getAttribute('data-link-path')
    ?.split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

  return {
    element: linkEl,
    exists: linkEl.getAttribute('data-link-exists') === 'true',
    pathKind,
    itemPath: itemPath ?? [],
    itemName: linkEl.getAttribute('data-link-item-name'),
    itemId: linkEl.getAttribute('data-link-item-id') as SidebarItemId | null,
    itemSlug: linkEl.getAttribute('data-link-slug') as ResourceSlug | null,
    href: linkEl.getAttribute('data-link-href'),
    heading: linkEl.getAttribute('data-link-heading'),
    type,
    status,
  }
}

export function getLinkAt(x: number, y: number): ParsedLinkElement | null {
  const el = document.elementFromPoint(x, y)
  const linkEl = el?.closest(GENERIC_LINK_SELECTOR)

  return linkEl ? parseLinkElement(linkEl) : null
}
