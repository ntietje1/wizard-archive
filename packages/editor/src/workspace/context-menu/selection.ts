import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { Predicate } from '../menu-context'
import type { AnyItem } from '../items'

type PredicateContext = Parameters<Predicate>[0]

export const isSingleSelection: Predicate = (ctx) => ctx.selectedItems.length === 1

export const hasSelection: Predicate = (ctx) => ctx.selectedItems.length > 0

function selectedItemHasFullAccess(item: AnyItem): boolean {
  return item.myPermissionLevel === PERMISSION_LEVEL.FULL_ACCESS
}

function selectedItemHasEditAccess(item: AnyItem): boolean {
  const permissionLevel = item.myPermissionLevel
  return (
    permissionLevel === PERMISSION_LEVEL.EDIT || permissionLevel === PERMISSION_LEVEL.FULL_ACCESS
  )
}

function selectedItemHasViewAccess(item: AnyItem): boolean {
  const permissionLevel = item.myPermissionLevel
  return (
    permissionLevel === PERMISSION_LEVEL.VIEW ||
    permissionLevel === PERMISSION_LEVEL.EDIT ||
    permissionLevel === PERMISSION_LEVEL.FULL_ACCESS
  )
}

function selectedItemIsTrashed(item: AnyItem): boolean {
  return item.isTrashed === true
}

function allSelectedItemsMatch(ctx: PredicateContext, predicate: (item: AnyItem) => boolean) {
  return ctx.selectedItems.length > 0 && ctx.selectedItems.every(predicate)
}

export const hasEditAccess: Predicate = (ctx) => {
  return ctx.permissionLevel === PERMISSION_LEVEL.EDIT || hasFullAccess(ctx)
}

export const hasFullAccess: Predicate = (ctx) => {
  return ctx.permissionLevel === PERMISSION_LEVEL.FULL_ACCESS
}

export const allSelectedItemsHaveFullAccess: Predicate = (ctx) => {
  return allSelectedItemsMatch(ctx, selectedItemHasFullAccess)
}

export const allSelectedItemsHaveEditAccess: Predicate = (ctx) => {
  return allSelectedItemsMatch(ctx, selectedItemHasEditAccess)
}

export const allSelectedItemsHaveViewAccess: Predicate = (ctx) => {
  return allSelectedItemsMatch(ctx, selectedItemHasViewAccess)
}

export const allSelectedItemsNotTrashed: Predicate = (ctx) => {
  return allSelectedItemsMatch(ctx, (item) => !selectedItemIsTrashed(item))
}

export const isItemNotTrashed: Predicate = (ctx) => !!ctx.item && ctx.item.isTrashed !== true
