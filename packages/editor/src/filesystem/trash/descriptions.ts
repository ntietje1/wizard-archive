import type { AnyItem } from '../../workspace/items'
import { collectDescendantIdsFromItems } from '../domain/tree'
import { isFolderItem } from '../../workspace/sidebar/utils/sidebar-item-types'

export function permanentDeleteDescription(item: AnyItem, allTrashedItems: Array<AnyItem>): string {
  const descendantCount = isFolderItem(item)
    ? collectDescendantIdsFromItems(item.id, allTrashedItems).size
    : 0
  const base = `Are you sure you want to permanently delete "${item.name}"?`
  const detail =
    descendantCount > 0
      ? ` This will also delete ${descendantCount} ${descendantCount === 1 ? 'item' : 'items'} inside it.`
      : ''
  return `${base}${detail} This action cannot be undone.`
}

export function permanentDeleteItemsDescription(
  items: Array<AnyItem>,
  allTrashedItems: Array<AnyItem>,
): string {
  const descendantIds = new Set<string>()
  const selectedIds = new Set(items.map((item) => item.id))

  for (const item of items) {
    if (!isFolderItem(item)) continue

    for (const descendantId of collectDescendantIdsFromItems(item.id, allTrashedItems)) {
      if (!selectedIds.has(descendantId)) {
        descendantIds.add(descendantId)
      }
    }
  }

  if (descendantIds.size === 0) {
    return `This will permanently delete ${selectedItemsLabel(items.length)} and cannot be undone.`
  }

  return `This will permanently delete ${selectedItemsLabel(items.length)} and ${descendantItemsLabel(descendantIds.size)} inside selected folders. This action cannot be undone.`
}

export function emptyTrashDescription(count: number): string {
  return `Are you sure you want to permanently delete ${count === 1 ? '1 item' : `all ${count} items`} in the trash? This action cannot be undone.`
}

function selectedItemsLabel(count: number): string {
  return `${count} selected ${count === 1 ? 'item' : 'items'}`
}

function descendantItemsLabel(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`
}
