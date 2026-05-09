import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

export interface SidebarItemVisualState {
  isSelected?: boolean
  isViewing?: boolean
  isMultiSelected?: boolean
}

const sidebarItemMutedTextClass = 'text-foreground/70 group-hover:text-foreground/90'
const sidebarItemViewingTextClass = 'text-foreground'

export function getSidebarItemVisualState({
  item,
  selectedItemIds,
  selectedSlug,
}: {
  item: AnySidebarItem
  selectedItemIds?: Array<Id<'sidebarItems'>> | null
  selectedSlug?: SidebarItemSlug | null
}): SidebarItemVisualState {
  const selectedIds = selectedItemIds ?? []
  return {
    isSelected: selectedIds.includes(item._id),
    isViewing: selectedSlug === item.slug,
    isMultiSelected: selectedIds.includes(item._id) && selectedIds.length > 1,
  }
}

export function sidebarItemBackgroundClass({
  isSelected = false,
  isViewing = false,
  isMultiSelected = false,
}: SidebarItemVisualState = {}) {
  if (isViewing && isMultiSelected) return 'bg-primary/18 dark:bg-primary/30'
  if (isViewing) return 'bg-muted-foreground/10 dark:bg-muted/70'
  if (isSelected)
    return 'bg-primary/12 hover:bg-primary/16 dark:bg-primary/20 dark:hover:bg-primary/28'
  return 'hover:bg-muted-foreground/6 dark:hover:bg-muted/50'
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
  'flex items-center shrink-0 invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto has-[[data-share-open]]:visible has-[[data-share-open]]:opacity-100 has-[[data-share-open]]:pointer-events-auto'

export function sidebarItemHoverOverlayClass({ isViewing = false }: SidebarItemVisualState = {}) {
  return isViewing ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
}

export function sidebarItemFolderFillClass({
  isSelected = false,
  isViewing = false,
  isMultiSelected = false,
}: SidebarItemVisualState = {}) {
  if (isViewing && isMultiSelected) return 'fill-primary/18 dark:fill-primary/30'
  if (isViewing) return 'fill-muted-foreground/10 dark:fill-muted/70'
  if (isSelected) return 'fill-primary/12 dark:fill-primary/20'
  return 'fill-card'
}

export function sidebarItemHoverFillClass({ isSelected = false }: SidebarItemVisualState = {}) {
  return isSelected
    ? 'fill-primary/16 dark:fill-primary/28'
    : 'fill-muted-foreground/6 dark:fill-muted/50'
}
