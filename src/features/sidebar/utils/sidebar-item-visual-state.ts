import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

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
  selectedSlug,
  cutItemIds,
}: {
  item: AnySidebarItem
  selectedItemIds?: Array<Id<'sidebarItems'>> | null
  selectedSlug?: SidebarItemSlug | null
  cutItemIds?: ReadonlyArray<Id<'sidebarItems'>> | null
}): SidebarItemVisualState {
  const selectedIds = selectedItemIds ?? []
  const cutIds = cutItemIds ?? []
  return {
    isSelected: selectedIds.includes(item._id),
    isViewing: selectedSlug === item.slug,
    isMultiSelected: selectedIds.includes(item._id) && selectedIds.length > 1,
    isCut: cutIds.includes(item._id),
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
      'bg-muted-foreground/10 dark:bg-muted/70 group-focus-within/sidebar-surface:bg-primary/18 group-focus-within/sidebar-surface:dark:bg-primary/30',
      isCut,
    )
  if (isViewing) return withCutOpacity('bg-muted-foreground/10 dark:bg-muted/70', isCut)
  if (isSelected)
    return withCutOpacity(
      'bg-muted-foreground/10 hover:bg-muted-foreground/8 dark:bg-muted/60 dark:hover:bg-muted/70 group-focus-within/sidebar-surface:bg-primary/12 group-focus-within/sidebar-surface:hover:bg-primary/16 group-focus-within/sidebar-surface:dark:bg-primary/20 group-focus-within/sidebar-surface:dark:hover:bg-primary/28',
      isCut,
    )
  return withCutOpacity('hover:bg-muted-foreground/6 dark:hover:bg-muted/50', isCut)
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
  'flex items-center shrink-0 opacity-0 group-hover:opacity-100 has-[[data-share-open]]:opacity-100'
