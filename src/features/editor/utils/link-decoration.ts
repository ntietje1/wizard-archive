export const LINK_ROLE = {
  content: 'content',
  prefix: 'prefix',
  bracketOpen: 'bracket-open',
  bracketMiddle: 'bracket-middle',
  target: 'target',
  bracketClose: 'bracket-close',
} as const

export type LinkRole = (typeof LINK_ROLE)[keyof typeof LINK_ROLE]
export type LinkType = 'wiki' | 'md-internal' | 'md-external'
export type LinkStatus = 'exists' | 'ghost' | 'external'

interface CreateLinkDecorationStateOptions {
  type: LinkType
  exists: boolean
  href?: string | null
  itemPath?: Array<string> | null
  itemName?: string | null
  heading?: string | null
  color?: string | null
  isViewerMode: boolean
  isActive: boolean
}

export interface LinkDecorationState {
  type: LinkType
  status: LinkStatus
  interaction: {
    viewer: boolean
    active: boolean
  }
  style: string | undefined
  linkAttrs: Record<string, string>
  createPartAttrs: (role: LinkRole, includeLinkAttrs?: boolean) => Record<string, string>
}

export function createLinkDecorationState({
  type,
  exists,
  href,
  itemPath,
  itemName,
  heading,
  color,
  isViewerMode,
  isActive,
}: CreateLinkDecorationStateOptions): LinkDecorationState {
  const status: LinkStatus = type === 'md-external' ? 'external' : exists ? 'exists' : 'ghost'
  const linkAttrs: Record<string, string> = {
    'data-link-exists': exists ? 'true' : 'false',
    'data-link-type': type,
  }

  if (href) {
    linkAttrs['data-link-href'] = href
  }
  if (itemPath && itemPath.length > 0) {
    linkAttrs['data-link-path'] = itemPath.join('/')
  }
  if (itemName) {
    linkAttrs['data-link-item-name'] = itemName
  }
  if (heading) {
    linkAttrs['data-link-heading'] = heading
  }

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
    createPartAttrs(role, includeLinkAttrs = false) {
      return includeLinkAttrs
        ? {
            'data-link-role': role,
            ...stateAttrs,
            ...linkAttrs,
          }
        : {
            'data-link-role': role,
            ...stateAttrs,
          }
    },
  }
}
