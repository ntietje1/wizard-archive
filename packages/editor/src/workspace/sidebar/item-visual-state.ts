import type { ResourceId } from '../../resources/domain-id'
import type { AnyItem } from '../items'

export interface SidebarItemVisualState {
  isSelected?: boolean
  isViewing?: boolean
  isMultiSelected?: boolean
  isCut?: boolean
}

const sidebarItemMutedTextClass = 'text-foreground/70 group-hover:text-foreground/90'
const sidebarItemViewingTextClass = 'text-foreground'

export function getSidebarItemVisualState({
  item,
  selectedItemIds,
  currentItemId,
  cutItemIds,
}: {
  item: AnyItem
  selectedItemIds?: ReadonlyArray<ResourceId> | null
  currentItemId?: ResourceId | null
  cutItemIds?: ReadonlyArray<ResourceId> | null
}): SidebarItemVisualState {
  const selectedIds = selectedItemIds ?? []
  const cutIds = cutItemIds ?? []
  const isSelected = selectedIds.includes(item.id)
  return {
    isSelected,
    isViewing: currentItemId === item.id,
    isMultiSelected: isSelected && selectedIds.length > 1,
    isCut: cutIds.includes(item.id),
  }
}

function withCutOpacity(className: string, isCut: boolean) {
  return isCut ? `${className} opacity-60` : className
}

export function sidebarItemBackgroundClass({
  isSelected = false,
  isViewing = false,
  isMultiSelected = false,
  isCut = false,
}: SidebarItemVisualState = {}) {
  if (isViewing && isMultiSelected)
    return withCutOpacity(
      'bg-item-viewing group-focus-within/sidebar-surface:bg-item-selected-focus',
      isCut,
    )
  if (isViewing) return withCutOpacity('bg-item-viewing', isCut)
  if (isSelected)
    return withCutOpacity(
      'bg-item-selected hover:bg-item-selected-hover group-focus-within/sidebar-surface:bg-item-selected-focus group-focus-within/sidebar-surface:hover:bg-item-selected-focus-hover',
      isCut,
    )
  return withCutOpacity('hover:bg-item-hover', isCut)
}

function sidebarItemTextClass({ isViewing = false }: SidebarItemVisualState = {}) {
  return isViewing ? sidebarItemViewingTextClass : sidebarItemMutedTextClass
}

export function sidebarItemNameClass(visualState: SidebarItemVisualState = {}) {
  return sidebarItemTextClass(visualState)
}

export function sidebarItemIconClass(visualState: SidebarItemVisualState = {}) {
  return sidebarItemTextClass(visualState)
}

export function sidebarItemActionButtonClass(visualState: SidebarItemVisualState = {}) {
  return sidebarItemTextClass(visualState)
}

export const sidebarItemActionGroupClass =
  'flex w-0 shrink-0 items-center overflow-hidden opacity-0 group-hover:w-auto group-hover:overflow-visible group-hover:opacity-100 focus-within:w-auto focus-within:overflow-visible focus-within:opacity-100 has-[[data-share-open]]:w-auto has-[[data-share-open]]:overflow-visible has-[[data-share-open]]:opacity-100'
