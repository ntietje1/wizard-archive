import { parseWizardEditorResourceSlug } from '@wizard-archive/editor/adapter'
import type { WizardEditorResourceSlug } from '@wizard-archive/editor/adapter'

export type WorkspaceRouteSearch =
  | { item: WizardEditorResourceSlug; heading?: string; trash?: never }
  | { trash: true; item?: never; heading?: never }
  | { item?: never; heading?: never; trash?: never }

const MAX_WORKSPACE_ROUTE_HEADING_LENGTH = 512

export const validateSearch = (search: Record<string, unknown>): WorkspaceRouteSearch => {
  const requestedItem =
    'item' in search && typeof search.item === 'string' && search.item.trim().length > 0
      ? search.item.trim()
      : undefined
  const requestedHeading =
    'heading' in search && typeof search.heading === 'string' && search.heading.trim().length > 0
      ? search.heading.trim()
      : undefined
  const trashRequested = 'trash' in search && search.trash === true

  if (trashRequested && (requestedItem || requestedHeading)) return {}
  if (trashRequested) return { trash: true }

  const item = requestedItem ? parseWizardEditorResourceSlug(requestedItem) : null
  if (!item) return {}

  if (requestedHeading && requestedHeading.length <= MAX_WORKSPACE_ROUTE_HEADING_LENGTH) {
    return { item, heading: requestedHeading }
  }

  return { item }
}

export function parseWorkspaceRouteSearchParams(
  searchParams: URLSearchParams,
): WorkspaceRouteSearch {
  return validateSearch({
    item: searchParams.get('item') ?? undefined,
    heading: searchParams.get('heading') ?? undefined,
    trash: searchParams.get('trash') === 'true',
  })
}
