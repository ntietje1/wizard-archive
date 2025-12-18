import type {
  SidebarItemOrRootType,
  SidebarItemType,
} from 'convex/sidebarItems/types'
import type { Predicate, ViewContext } from './types'

export const isType =
  (...types: SidebarItemType[]): Predicate =>
  (ctx) =>
    ctx.item ? types.includes(ctx.item.type) : false

export const isNotType =
  (...types: SidebarItemType[]): Predicate =>
  (ctx) =>
    ctx.item ? !types.includes(ctx.item.type) : true

export const inView =
  (...views: ViewContext[]): Predicate =>
  (ctx) =>
    views.includes(ctx.viewContext)

export const notInView =
  (...views: ViewContext[]): Predicate =>
  (ctx) =>
    !views.includes(ctx.viewContext)

export const inSidebar: Predicate = (ctx) => ctx.viewContext === 'sidebar'

export const notInSidebar: Predicate = (ctx) => ctx.viewContext !== 'sidebar'

export const viewingMap: Predicate = (ctx) => ctx.viewContext === 'map-view'

export const viewingCanvas: Predicate = (ctx) =>
  ctx.viewContext === 'canvas-view'

export const hasParent =
  (...parents: SidebarItemOrRootType[]): Predicate =>
  (ctx) =>
    ctx.parentType !== null && parents.includes(ctx.parentType)

export const underCategory: Predicate = (ctx) => Boolean(ctx.item?.categoryId)

export const underFolder: Predicate = (ctx) => Boolean(ctx.item?.parentId)

export const folderHasCategoryId: Predicate = (ctx) => {
  if (!ctx.item || ctx.item.type !== 'folders') return false
  return Boolean(ctx.item.categoryId)
}

export const atRoot: Predicate = (ctx) => ctx.parentType === 'root'

export const hasCategory: Predicate = (ctx) => Boolean(ctx.category)

export const inCategory =
  (categorySlug: string): Predicate =>
  (ctx) =>
    ctx.category?.slug === categorySlug

export const always: Predicate = () => true

export const never: Predicate = () => false

export const hasActiveMap: Predicate = (ctx) => Boolean(ctx.activeMapId)

export const isPinnedOnActiveMap: Predicate = (ctx) => {
  if (!ctx.item || !ctx.pinnedItemIds) return false
  return ctx.pinnedItemIds.has(ctx.item._id)
}

export const mapIsNotActiveMap: Predicate = (ctx) => {
  if (!ctx.item || !ctx.activeMapId) return false
  return ctx.activeMapId !== ctx.item._id
}

export const hasPinContext: Predicate = (ctx) => Boolean(ctx.pinId && ctx.mapId)
