import { DOMAIN_ID_KIND, assertDomainId } from './domain-id'
import type { ResourceId } from './domain-id'

export const MAX_RESOURCE_BOOKMARK_MUTATION_RESOURCES = 100
export const MAX_RESOURCE_BOOKMARKS_PER_ACTOR = 1_000

export type ResourceBookmarkMutationResult =
  | Readonly<{ status: 'completed' }>
  | Readonly<{
      status: 'rejected'
      reason: 'invalid_request' | 'selection_too_large' | 'resource_missing'
    }>

export type ResourceBookmarkSelection =
  | Readonly<{ status: 'accepted'; resourceIds: ReadonlyArray<ResourceId> }>
  | Readonly<{
      status: 'rejected'
      reason: 'invalid_request' | 'selection_too_large'
    }>

export function parseResourceBookmarkSelection(
  resourceIds: ReadonlyArray<string>,
): ResourceBookmarkSelection {
  let normalized: ReadonlyArray<ResourceId>
  try {
    normalized = Array.from(
      new Set(resourceIds.map((resourceId) => assertDomainId(DOMAIN_ID_KIND.resource, resourceId))),
    ).sort()
  } catch {
    return { status: 'rejected', reason: 'invalid_request' }
  }
  if (normalized.length === 0) return { status: 'rejected', reason: 'invalid_request' }
  if (normalized.length > MAX_RESOURCE_BOOKMARK_MUTATION_RESOURCES) {
    return { status: 'rejected', reason: 'selection_too_large' }
  }
  return { status: 'accepted', resourceIds: normalized }
}
