import type { LinkPathKind, ResolvedLink } from '../../../../../shared/links/types'

export const LINK_ROLE = {
  content: 'content',
  prefix: 'prefix',
  bracketOpen: 'bracket-open',
  bracketMiddle: 'bracket-middle',
  target: 'target',
  bracketClose: 'bracket-close',
} as const

type LinkRole = (typeof LINK_ROLE)[keyof typeof LINK_ROLE]
export type LinkType = 'wiki' | 'md-internal' | 'md-external'
export type LinkStatus = 'exists' | 'ghost' | 'external' | 'rejected'

interface CreateLinkDecorationStateOptions {
  type: LinkType
  resolutionStatus: ResolvedLink['status']
  href?: string | null
  itemId?: string | null
  itemSlug?: string | null
  pathKind?: LinkPathKind | null
  itemPath?: Array<string> | null
  itemName?: string | null
  heading?: string | null
  color?: string | null
  isViewerMode: boolean
  isActive: boolean
}

interface LinkDecorationState {
  type: LinkType
  status: LinkStatus
  interaction: {
    viewer: boolean
    active: boolean
  }
  style: string | undefined
  linkAttrs: Record<string, string>
  createPartAttrs: (role: LinkRole) => Record<string, string>
}

export function createLinkDecorationState({
  type,
  resolutionStatus,
  href,
  itemId,
  itemSlug,
  pathKind,
  itemPath,
  itemName,
  heading,
  color,
  isViewerMode,
  isActive,
}: CreateLinkDecorationStateOptions): LinkDecorationState {
  const status = resolveLinkStatus(type, resolutionStatus)
  const linkAttrs = createLinkAttributes({
    type,
    resolutionStatus,
    href,
    itemId,
    itemSlug,
    pathKind,
    itemPath,
    itemName,
    heading,
  })

  const stateAttrs = {
    'data-link-status': status,
    'data-link-viewer': isViewerMode ? 'true' : 'false',
    'data-link-active': isActive ? 'true' : 'false',
  }

  return {
    type,
    status,
    interaction: {
      viewer: isViewerMode,
      active: isActive,
    },
    style: color ? `color: ${color}` : undefined,
    linkAttrs,
    createPartAttrs(role) {
      return {
        'data-link-role': role,
        ...stateAttrs,
        ...linkAttrs,
      }
    },
  }
}

function resolveLinkStatus(type: LinkType, resolutionStatus: ResolvedLink['status']): LinkStatus {
  if (resolutionStatus === 'rejected') return 'rejected'
  if (type === 'md-external') return 'external'
  return resolutionStatus === 'resolved' ? 'exists' : 'ghost'
}

function createLinkAttributes({
  type,
  resolutionStatus,
  href,
  itemId,
  itemSlug,
  pathKind,
  itemPath,
  itemName,
  heading,
}: Pick<
  CreateLinkDecorationStateOptions,
  | 'type'
  | 'resolutionStatus'
  | 'href'
  | 'itemId'
  | 'itemSlug'
  | 'pathKind'
  | 'itemPath'
  | 'itemName'
  | 'heading'
>) {
  const attributes: Record<string, string> = {
    'data-link-exists': resolutionStatus === 'resolved' ? 'true' : 'false',
    'data-link-type': type,
  }

  setLinkAttribute(attributes, 'data-link-href', href)
  setLinkAttribute(attributes, 'data-link-item-id', itemId)
  setLinkAttribute(attributes, 'data-link-slug', itemSlug)
  setLinkAttribute(attributes, 'data-link-path-kind', pathKind)
  setLinkAttribute(attributes, 'data-link-path', itemPath?.join('/'))
  setLinkAttribute(attributes, 'data-link-item-name', itemName)
  setLinkAttribute(attributes, 'data-link-heading', heading)

  return attributes
}

function setLinkAttribute(
  attributes: Record<string, string>,
  name: string,
  value: string | null | undefined,
) {
  if (value) attributes[name] = value
}
