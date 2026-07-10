import type { SidebarItemId } from '../../../../shared/common/ids'

export function getDragItemId(sourceData: Record<string, unknown>): SidebarItemId | null {
  const id = sourceData.sidebarItemId
  return typeof id === 'string' ? (id as SidebarItemId) : null
}

export function getDragItemIds(sourceData: Record<string, unknown>): Array<SidebarItemId> {
  return filterStringIds(sourceData.sidebarItemIds)
}

export function getDragPreviewItemIds(sourceData: Record<string, unknown>): Array<SidebarItemId> {
  const ids = sourceData.dragPreviewItemIds
  return Array.isArray(ids) ? filterStringIds(ids) : getDragItemIds(sourceData)
}

function filterStringIds(value: unknown): Array<SidebarItemId> {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is SidebarItemId => typeof id === 'string')
}
