import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { VIEW_CONTEXT } from './constants'
import type { Predicate, ViewContext } from './types'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'

type PredicateContext = Parameters<Predicate>[0]

export const always: Predicate = () => true
export const never: Predicate = () => false

export const isSidebarItem: Predicate = (ctx) => ctx.item !== undefined

export const isSingleSelection: Predicate = (ctx) =>
  (ctx.selectedItems?.length ?? (ctx.item ? 1 : 0)) <= 1

// selectedItems is authoritative when present, even if empty; item is the single-item fallback.
export const hasSelection: Predicate = (ctx) =>
  (ctx.selectedItems?.length ?? (ctx.item ? 1 : 0)) > 0

function selectedItems(ctx: PredicateContext) {
  return ctx.selectedItems ?? (ctx.item ? [ctx.item] : [])
}

function selectedItemHasFullAccess(ctx: PredicateContext, itemIndex: number): boolean {
  if (ctx.selectedItems !== undefined) {
    return ctx.selectedItems[itemIndex]?.myPermissionLevel === PERMISSION_LEVEL.FULL_ACCESS
  }
  return hasFullAccess(ctx)
}

function selectedItemHasEditAccess(ctx: PredicateContext, itemIndex: number): boolean {
  if (ctx.selectedItems !== undefined) {
    const permissionLevel = ctx.selectedItems[itemIndex]?.myPermissionLevel
    return (
      permissionLevel === PERMISSION_LEVEL.EDIT || permissionLevel === PERMISSION_LEVEL.FULL_ACCESS
    )
  }
  return hasEditAccess(ctx)
}

function selectedItemIsTrashed(ctx: PredicateContext, itemIndex: number): boolean {
  if (ctx.selectedItems !== undefined) {
    return ctx.selectedItems[itemIndex]?.location === SIDEBAR_ITEM_LOCATION.trash
  }
  return isItemTrashed(ctx)
}

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
    views.includes(ctx.surface)

export const notInView =
  (...views: Array<ViewContext>): Predicate =>
  (ctx) =>
    !views.includes(ctx.surface)

export const inSidebar: Predicate = (ctx) => ctx.surface === VIEW_CONTEXT.SIDEBAR

export const notInSidebar: Predicate = (ctx) => ctx.surface !== VIEW_CONTEXT.SIDEBAR

export const hasBlockNoteEditor: Predicate = (ctx) => ctx.editor !== undefined

export const hasBlockNoteId: Predicate = (ctx) => ctx.blockNoteId !== undefined

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

export const allSelectedItemsHaveFullAccess: Predicate = (ctx) => {
  const items = selectedItems(ctx)
  return items.length > 0 && items.every((_, index) => selectedItemHasFullAccess(ctx, index))
}

export const allSelectedItemsHaveEditAccess: Predicate = (ctx) => {
  const items = selectedItems(ctx)
  return items.length > 0 && items.every((_, index) => selectedItemHasEditAccess(ctx, index))
}

export const allSelectedItemsTrashed: Predicate = (ctx) => {
  const items = selectedItems(ctx)
  return items.length > 0 && items.every((_, index) => selectedItemIsTrashed(ctx, index))
}

export const allSelectedItemsNotTrashed: Predicate = (ctx) => {
  const items = selectedItems(ctx)
  return items.length > 0 && items.every((_, index) => !selectedItemIsTrashed(ctx, index))
}

export const canWrite: Predicate = (ctx) => {
  return ctx.item ? hasEditAccess(ctx) : isDm(ctx)
}

export const isItemTrashed: Predicate = (ctx) => ctx.isItemTrashed === true

export const isItemNotTrashed: Predicate = (ctx) => ctx.isItemTrashed !== true

export const isTrashView: Predicate = (ctx) => ctx.isTrashView === true
