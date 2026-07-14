import type { ResourceId } from '../resources/domain-id'
export function getDragItemId(sourceData: Record<string, unknown>): ResourceId | null {
  const id = sourceData.sidebarItemId
  return typeof id === 'string' ? (id as ResourceId) : null
}

export function getDragItemIds(sourceData: Record<string, unknown>): Array<ResourceId> {
  return filterStringIds(sourceData.sidebarItemIds)
}

export function getDragPreviewItemIds(sourceData: Record<string, unknown>): Array<ResourceId> {
  const ids = sourceData.dragPreviewItemIds
  return Array.isArray(ids) ? filterStringIds(ids) : getDragItemIds(sourceData)
}

function filterStringIds(value: unknown): Array<ResourceId> {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is ResourceId => typeof id === 'string')
}
