import { SIDEBAR_ITEM_STATUS } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarCacheSnapshot } from './filesystem-cache-patches'

export type FileSystemReadModel = {
  sidebar: Array<AnySidebarItem>
  trash: Array<AnySidebarItem>
  itemsById: Map<Id<'sidebarItems'>, AnySidebarItem>
  itemsBySlug: Map<SidebarItemSlug, AnySidebarItem>
  childrenByParent: Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>
  getItem: (itemId: Id<'sidebarItems'>) => AnySidebarItem | undefined
  getItems: (itemIds: Array<Id<'sidebarItems'>>) => Array<AnySidebarItem>
  getItemBySlug: (slug: SidebarItemSlug) => AnySidebarItem | undefined
  getChildren: (parentId: Id<'sidebarItems'> | null) => Array<AnySidebarItem>
}

function addActiveChild(
  childrenByParent: Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>,
  item: AnySidebarItem,
) {
  if (item.status !== SIDEBAR_ITEM_STATUS.active) return
  const siblings = childrenByParent.get(item.parentId)
  if (siblings) {
    siblings.push(item)
  } else {
    childrenByParent.set(item.parentId, [item])
  }
}

export function createFileSystemReadModel(snapshot: SidebarCacheSnapshot): FileSystemReadModel {
  const itemsById = new Map<Id<'sidebarItems'>, AnySidebarItem>()
  const itemsBySlug = new Map<SidebarItemSlug, AnySidebarItem>()
  const itemSourcesById = new Map<Id<'sidebarItems'>, 'sidebar' | 'trash'>()
  const itemSourcesBySlug = new Map<SidebarItemSlug, 'sidebar' | 'trash'>()
  const childrenByParent = new Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>()

  const addItem = (item: AnySidebarItem, source: 'sidebar' | 'trash') => {
    const existingIdItem = itemsById.get(item._id)
    if (existingIdItem) {
      throw new Error(
        `Duplicate sidebar item id in filesystem cache: ${item._id} (${itemSourcesById.get(existingIdItem._id)}:${existingIdItem.slug} and ${source}:${item.slug})`,
      )
    }
    const existingSlugItem = itemsBySlug.get(item.slug)
    if (existingSlugItem) {
      throw new Error(
        `Duplicate sidebar item slug in filesystem cache: ${item.slug} (${itemSourcesBySlug.get(existingSlugItem.slug)}:${existingSlugItem._id} and ${source}:${item._id})`,
      )
    }
    itemsById.set(item._id, item)
    itemsBySlug.set(item.slug, item)
    itemSourcesById.set(item._id, source)
    itemSourcesBySlug.set(item.slug, source)
    addActiveChild(childrenByParent, item)
  }

  for (const item of snapshot.sidebar) addItem(item, 'sidebar')
  for (const item of snapshot.trash) addItem(item, 'trash')
  itemSourcesById.clear()
  itemSourcesBySlug.clear()

  return {
    sidebar: snapshot.sidebar,
    trash: snapshot.trash,
    itemsById,
    itemsBySlug,
    childrenByParent,
    getItem: (itemId) => itemsById.get(itemId),
    getItems: (itemIds) =>
      itemIds
        .map((itemId) => itemsById.get(itemId))
        .filter((item): item is AnySidebarItem => Boolean(item)),
    getItemBySlug: (slug) => itemsBySlug.get(slug),
    getChildren: (parentId) => childrenByParent.get(parentId) ?? [],
  }
}
