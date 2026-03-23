import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { VIEW_CONTEXT } from './constants'
import type { Predicate, ViewContext } from './types'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'

export const always: Predicate = () => true
export const never: Predicate = () => false

export const isSidebarItem: Predicate = (ctx) => ctx.item !== undefined

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

export const inSidebar: Predicate = (ctx) =>
  ctx.viewContext === VIEW_CONTEXT.SIDEBAR

export const notInSidebar: Predicate = (ctx) =>
  ctx.viewContext !== VIEW_CONTEXT.SIDEBAR

export const inNoteView: Predicate = (ctx) =>
  ctx.viewContext === VIEW_CONTEXT.NOTE_VIEW

export const hasBlockNoteEditor: Predicate = (ctx) => ctx.editor !== undefined

export const hasBlockId: Predicate = (ctx) => ctx.blockId !== undefined

export const viewingCanvas: Predicate = (ctx) =>
  ctx.viewContext === VIEW_CONTEXT.CANVAS_VIEW

export const atRoot: Predicate = (ctx) => !isSidebarItem(ctx)

export const hasActiveMap: Predicate = (ctx) => Boolean(ctx.activeMap)

export const isPinnedOnActiveMap: Predicate = (ctx) => {
  if (!ctx.item || !ctx.activeMap) return false
  return ctx.activeMap.pins.some((pin) => pin.itemId === ctx.item?._id)
}

export const isNotActiveMap: Predicate = (ctx) => {
  if (!ctx.item || !ctx.activeMap) return false
  return ctx.activeMap._id !== ctx.item._id
}

export const isActiveMap: Predicate = (ctx) => {
  if (!ctx.item || !ctx.activeMap) return false
  return ctx.activeMap._id === ctx.item._id
}

export const hasPinContext: Predicate = (ctx) => {
  return Boolean(ctx.activePin && ctx.activeMap)
}

export const hasMapContext: Predicate = (ctx) => {
  return Boolean(ctx.activeMap)
}

export const hasActiveSession: Predicate = (ctx) => {
  return ctx.hasActiveSession === true
}

export const hasNoActiveSession: Predicate = (ctx) => {
  return ctx.hasActiveSession !== true
}

export const isDm: Predicate = (ctx) => {
  return ctx.memberRole === CAMPAIGN_MEMBER_ROLE.DM
}

export const isPlayer: Predicate = (ctx) => {
  return ctx.memberRole === CAMPAIGN_MEMBER_ROLE.Player
}

export const hasViewAccess: Predicate = (ctx) => {
  return ctx.permissionLevel === PERMISSION_LEVEL.VIEW || hasEditAccess(ctx)
}

export const hasEditAccess: Predicate = (ctx) => {
  return ctx.permissionLevel === PERMISSION_LEVEL.EDIT || hasFullAccess(ctx)
}

export const hasFullAccess: Predicate = (ctx) => {
  return ctx.permissionLevel === PERMISSION_LEVEL.FULL_ACCESS
}

export const isItemTrashed: Predicate = (ctx) => ctx.isItemTrashed === true

export const isItemNotTrashed: Predicate = (ctx) => ctx.isItemTrashed !== true

export const isTrashView: Predicate = (ctx) => ctx.isTrashView === true
