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
  cutItemIds?: Array<Id<'sidebarItems'>> | null
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
  if (isViewing && isMultiSelected) return withCutOpacity('bg-primary/18 dark:bg-primary/30', isCut)
  if (isViewing) return withCutOpacity('bg-muted-foreground/10 dark:bg-muted/70', isCut)
  if (isSelected)
    return withCutOpacity(
      'bg-primary/12 hover:bg-primary/16 dark:bg-primary/20 dark:hover:bg-primary/28',
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
  'flex items-center shrink-0 w-0 overflow-hidden opacity-0 pointer-events-none group-hover:w-auto group-hover:overflow-visible group-hover:opacity-100 group-hover:pointer-events-auto has-[[data-share-open]]:w-auto has-[[data-share-open]]:overflow-visible has-[[data-share-open]]:opacity-100 has-[[data-share-open]]:pointer-events-auto'

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
