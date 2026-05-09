import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

export interface SidebarItemVisualState {
  isSelected: boolean
  isViewing: boolean
  isMultiSelected: boolean
}

const sidebarItemMutedTextClass = 'text-foreground/70 group-hover:text-foreground/90'

export function getSidebarItemVisualState({
  item,
  selectedItemIds,
  selectedSlug,
}: {
  item: AnySidebarItem
  selectedItemIds: Array<Id<'sidebarItems'>>
  selectedSlug: SidebarItemSlug | null
}): SidebarItemVisualState {
  return {
    isSelected: selectedItemIds.includes(item._id),
    isViewing: selectedSlug === item.slug,
    isMultiSelected: selectedItemIds.includes(item._id) && selectedItemIds.length > 1,
  }
}

export function sidebarItemBackgroundClass({
  isSelected,
  isViewing,
  isMultiSelected,
}: SidebarItemVisualState) {
  if (isSelected && isViewing && isMultiSelected) return 'bg-primary/18 dark:bg-primary/30'
  if (isViewing) return 'bg-muted-foreground/10 dark:bg-muted/70'
  if (isSelected)
    return 'bg-primary/12 hover:bg-primary/16 dark:bg-primary/20 dark:hover:bg-primary/28'
  return 'hover:bg-muted-foreground/6 dark:hover:bg-muted/50'
}

export function sidebarItemNameClass({ isViewing }: SidebarItemVisualState) {
  return isViewing ? 'text-foreground' : sidebarItemMutedTextClass
}

export function sidebarItemIconClass({ isViewing }: SidebarItemVisualState) {
  return isViewing ? 'text-foreground' : sidebarItemMutedTextClass
}

export function sidebarItemActionButtonClass(visualState: SidebarItemVisualState) {
  return sidebarItemIconClass(visualState)
}

export function sidebarItemActionGroupClass() {
  return 'flex items-center shrink-0 w-0 overflow-hidden opacity-0 group-hover:w-auto group-hover:overflow-visible group-hover:opacity-100 has-[[data-share-open]]:w-auto has-[[data-share-open]]:overflow-visible has-[[data-share-open]]:opacity-100'
}

export function sidebarItemHoverOverlayClass({ isViewing }: SidebarItemVisualState) {
  return isViewing ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
}

export function sidebarItemFolderFillClass({
  isSelected,
  isViewing,
  isMultiSelected,
}: SidebarItemVisualState) {
  if (isSelected && isViewing && isMultiSelected) return 'fill-primary/18 dark:fill-primary/30'
  if (isViewing) return 'fill-muted-foreground/10 dark:fill-muted/70'
  if (isSelected) return 'fill-primary/12 dark:fill-primary/20'
  return 'fill-card'
}

export function sidebarItemHoverFillClass({ isSelected }: SidebarItemVisualState) {
  return isSelected
    ? 'fill-primary/16 dark:fill-primary/28'
    : 'fill-muted-foreground/6 dark:fill-muted/50'
}
