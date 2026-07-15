import { DOMAIN_ID_KIND, parseDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'

export type WorkspaceRouteSearch =
  | { resource: ResourceId; heading?: string; trash?: never }
  | { trash: true; resource?: never; heading?: never }
  | { resource?: never; heading?: never; trash?: never }

const MAX_WORKSPACE_ROUTE_HEADING_LENGTH = 512

export const validateSearch = (search: Record<string, unknown>): WorkspaceRouteSearch => {
  const requestedResource =
    'resource' in search && typeof search.resource === 'string' && search.resource.trim().length > 0
      ? search.resource.trim()
      : undefined
  const requestedHeading =
    'heading' in search && typeof search.heading === 'string' && search.heading.trim().length > 0
      ? search.heading.trim()
      : undefined
  const trashRequested = 'trash' in search && search.trash === true

  if (trashRequested && (requestedResource || requestedHeading)) return {}
  if (trashRequested) return { trash: true }

  const resource = requestedResource
    ? parseDomainId(DOMAIN_ID_KIND.resource, requestedResource)
    : null
  if (!resource) return {}

  if (requestedHeading && requestedHeading.length <= MAX_WORKSPACE_ROUTE_HEADING_LENGTH) {
    return { resource, heading: requestedHeading }
  }

  return { resource }
}

export function parseWorkspaceRouteSearchParams(
  searchParams: URLSearchParams,
): WorkspaceRouteSearch {
  return validateSearch({
    resource: searchParams.get('resource') ?? undefined,
    heading: searchParams.get('heading') ?? undefined,
    trash: searchParams.get('trash') === 'true',
  })
}
