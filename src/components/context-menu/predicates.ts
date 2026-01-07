import type {
  SidebarItemOrRootType,
  SidebarItemType,
} from 'convex/sidebarItems/types'
import type { Predicate, ViewContext } from './types'

export const isType =
  (...types: Array<SidebarItemType>): Predicate =>
  (ctx) =>
    ctx.item ? types.includes(ctx.item.type) : false

export const isNotType =
  (...types: Array<SidebarItemType>): Predicate =>
  (ctx) =>
    ctx.item ? !types.includes(ctx.item.type) : true

export const inView =
  (...views: Array<ViewContext>): Predicate =>
  (ctx) =>
    views.includes(ctx.viewContext)

export const notInView =
  (...views: Array<ViewContext>): Predicate =>
  (ctx) =>
    !views.includes(ctx.viewContext)

export const inSidebar: Predicate = (ctx) => ctx.viewContext === 'sidebar'

export const notInSidebar: Predicate = (ctx) => ctx.viewContext !== 'sidebar'

export const viewingMap: Predicate = (ctx) => ctx.viewContext === 'map-view'

export const viewingCanvas: Predicate = (ctx) =>
  ctx.viewContext === 'canvas-view'

export const hasParent =
  (...parents: Array<SidebarItemOrRootType>): Predicate =>
  (ctx) =>
    parents.includes(ctx.parentType)

export const underFolder: Predicate = (ctx) => Boolean(ctx.item?.parentId)

export const atRoot: Predicate = (ctx) => ctx.parentType === 'root'

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

export const hasActiveSession: Predicate = (ctx) => {
  return ctx.hasActiveSession === true
}

export const hasNoActiveSession: Predicate = (ctx) => {
  return ctx.hasActiveSession !== true
}
