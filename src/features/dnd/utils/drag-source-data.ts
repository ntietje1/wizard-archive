import type { Id } from 'convex/_generated/dataModel'

export function getDragItemId(sourceData: Record<string, unknown>): Id<'sidebarItems'> | null {
  const id = sourceData.sidebarItemId
  return typeof id === 'string' ? (id as Id<'sidebarItems'>) : null
}

export function getDragItemIds(sourceData: Record<string, unknown>): Array<Id<'sidebarItems'>> {
  const ids = sourceData.sidebarItemIds
  if (!Array.isArray(ids)) return []
  return ids.filter((id): id is Id<'sidebarItems'> => typeof id === 'string')
}

export function getDragPreviewItemIds(
  sourceData: Record<string, unknown>,
): Array<Id<'sidebarItems'>> {
  const ids = sourceData.sidebarDragPreviewItemIds
  if (Array.isArray(ids)) {
    return ids.filter((id): id is Id<'sidebarItems'> => typeof id === 'string')
  }
  return getDragItemIds(sourceData)
}
