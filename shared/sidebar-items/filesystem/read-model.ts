import type { SidebarItemId } from './types'
import { SIDEBAR_ITEM_STATUS } from '../types'
import type { SidebarItemStatus } from '../types'
import type { SidebarItemSlug } from '../slug'

type FileSystemReadModelItem = {
  _id: SidebarItemId
  slug?: string
  parentId: SidebarItemId | null
  status: SidebarItemStatus
}

export type FileSystemReadModel<T extends FileSystemReadModelItem> = {
  items: Array<T>
  itemsById: Map<SidebarItemId, T>
  itemsBySlug: Map<SidebarItemSlug, T>
  activeChildrenByParent: Map<SidebarItemId | null, Array<T>>
  getItem: (itemId: SidebarItemId) => T | undefined
  getItems: (itemIds: Array<SidebarItemId>) => Array<T>
  requireItems: (itemIds: Array<SidebarItemId>) => Array<T>
  getItemBySlug: (slug: SidebarItemSlug) => T | undefined
  getActiveChildren: (parentId: SidebarItemId | null) => Array<T>
}

export function createFileSystemReadModel<T extends FileSystemReadModelItem>(
  items: Array<T>,
): FileSystemReadModel<T> {
  const itemsById = new Map<SidebarItemId, T>()
  const itemsBySlug = new Map<SidebarItemSlug, T>()
  const activeChildrenByParent = new Map<SidebarItemId | null, Array<T>>()

  for (const item of items) {
    if (itemsById.has(item._id)) throw new Error(`Duplicate sidebar item id: ${item._id}`)
    itemsById.set(item._id, item)
    if (item.slug) {
      const slug = item.slug as SidebarItemSlug
      const existing = itemsBySlug.get(slug)
      if (existing) {
        throw new Error(`Duplicate sidebar item slug: ${slug} (${existing._id} and ${item._id})`)
      }
      itemsBySlug.set(slug, item)
    }
    if (item.status === SIDEBAR_ITEM_STATUS.active) {
      const children = activeChildrenByParent.get(item.parentId)
      if (children) {
        children.push(item)
      } else {
        activeChildrenByParent.set(item.parentId, [item])
      }
    }
  }

  return {
    items,
    itemsById,
    itemsBySlug,
    activeChildrenByParent,
    getItem: (itemId) => itemsById.get(itemId),
    getItems: (itemIds) =>
      itemIds.map((itemId) => itemsById.get(itemId)).filter((item): item is T => Boolean(item)),
    requireItems: (itemIds) => {
      const resolved = itemIds.map((itemId) => itemsById.get(itemId))
      const missing = itemIds.filter((_, index) => !resolved[index])
      if (missing.length > 0) {
        throw new Error(`Filesystem read model is missing sidebar items: ${missing.join(', ')}`)
      }
      return resolved as Array<T>
    },
    getItemBySlug: (slug) => itemsBySlug.get(slug),
    getActiveChildren: (parentId) => activeChildrenByParent.get(parentId) ?? [],
  }
}
