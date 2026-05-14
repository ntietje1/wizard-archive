import { SIDEBAR_ITEM_STATUS } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemSlug } from '../validation/slug'

export type FileSystemReadModelItem = {
  _id: Id<'sidebarItems'>
  slug?: string
  parentId: Id<'sidebarItems'> | null
  status: string
}

export type FileSystemReadModel<T extends FileSystemReadModelItem> = {
  items: Array<T>
  itemsById: Map<Id<'sidebarItems'>, T>
  itemsBySlug: Map<SidebarItemSlug, T>
  activeChildrenByParent: Map<Id<'sidebarItems'> | null, Array<T>>
  getItem: (itemId: Id<'sidebarItems'>) => T | undefined
  getItems: (itemIds: Array<Id<'sidebarItems'>>) => Array<T>
  requireItems: (itemIds: Array<Id<'sidebarItems'>>) => Array<T>
  getItemBySlug: (slug: SidebarItemSlug) => T | undefined
  getActiveChildren: (parentId: Id<'sidebarItems'> | null) => Array<T>
}

export function createFileSystemReadModel<T extends FileSystemReadModelItem>(
  items: Array<T>,
): FileSystemReadModel<T> {
  const itemsById = new Map<Id<'sidebarItems'>, T>()
  const itemsBySlug = new Map<SidebarItemSlug, T>()
  const activeChildrenByParent = new Map<Id<'sidebarItems'> | null, Array<T>>()

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
