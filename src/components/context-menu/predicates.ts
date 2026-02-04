import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import type { Predicate, ViewContext } from './types'
import type { SidebarItemType } from 'convex/sidebarItems/baseTypes'

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

export const inSidebar: Predicate = (ctx) => ctx.viewContext === 'sidebar'

export const notInSidebar: Predicate = (ctx) => ctx.viewContext !== 'sidebar'

export const inNoteView: Predicate = (ctx) => ctx.viewContext === 'note-view'

export const hasBlockNoteEditor: Predicate = (ctx) => ctx.editor !== undefined

export const hasBlockId: Predicate = (ctx) => ctx.blockId !== undefined

export const viewingCanvas: Predicate = (ctx) =>
  ctx.viewContext === 'canvas-view'

export const atRoot: Predicate = (ctx) => !isSidebarItem(ctx)

export const hasActiveMap: Predicate = (ctx) => Boolean(ctx.activeMap)

export const isPinnedOnActiveMap: Predicate = (ctx) => {
  if (!ctx.item || !ctx.activeMap) return false
  return ctx.activeMap.pins.some((pin) => pin.item._id === ctx.item?._id)
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

export const hasFullAccess: Predicate = (ctx) => {
  return ctx.permissionLevel === 'full_access'
}

export const hasEditAccess: Predicate = (ctx) => {
  return (
    ctx.permissionLevel === 'edit' || ctx.permissionLevel === 'full_access'
  )
}
