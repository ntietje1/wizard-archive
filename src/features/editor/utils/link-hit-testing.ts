import { LINK_ROLE } from './link-decoration'
import type { LinkType } from './link-decoration'

export interface ParsedLinkElement {
  element: Element
  exists: boolean
  itemPath: Array<string>
  itemName: string | null
  href: string | null
  heading: string | null
  type: LinkType
}

const GENERIC_LINK_SELECTOR = [
  `[data-link-role="${LINK_ROLE.content}"]`,
  `[data-link-role="${LINK_ROLE.prefix}"]`,
].join(', ')

const FALLBACK_LINK_SELECTOR = '.wiki-link-content, .md-link-display'

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

export function parseLinkElement(linkEl: Element): ParsedLinkElement | null {
  const type = getValidLinkType(linkEl.getAttribute('data-link-type'))
  if (!type) return null

  const itemPath = linkEl
    .getAttribute('data-link-path')
    ?.split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

  return {
    element: linkEl,
    exists: linkEl.getAttribute('data-link-exists') === 'true',
    itemPath: itemPath ?? [],
    itemName: linkEl.getAttribute('data-link-item-name'),
    href: linkEl.getAttribute('data-link-href'),
    heading: linkEl.getAttribute('data-link-heading'),
    type,
  }
}

export function getLinkAt(x: number, y: number): ParsedLinkElement | null {
  const el = document.elementFromPoint(x, y)
  const linkEl = el?.closest(GENERIC_LINK_SELECTOR) || el?.closest(FALLBACK_LINK_SELECTOR)

  return linkEl ? parseLinkElement(linkEl) : null
}
