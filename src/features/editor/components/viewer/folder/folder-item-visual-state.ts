import type { SidebarItemVisualState } from '~/features/sidebar/utils/sidebar-item-visual-state'

function withCutOpacity(className: string, isCut: boolean): string {
  return isCut ? `${className} opacity-60` : className
}

export function folderItemBackgroundClass({
  isSelected = false,
  isViewing = false,
  isMultiSelected = false,
  isCut = false,
}: SidebarItemVisualState = {}): string {
  if (isViewing && isMultiSelected)
    return withCutOpacity(
      'bg-item-card-viewing group-focus-within/sidebar-surface:bg-item-card-selected-focus-hover',
      isCut,
    )
  if (isViewing) return withCutOpacity('bg-item-card-viewing', isCut)
  if (isSelected)
    return withCutOpacity(
      'bg-item-card-selected hover:bg-item-card-selected-hover group-focus-within/sidebar-surface:bg-item-card-selected-focus group-focus-within/sidebar-surface:hover:bg-item-card-selected-focus-hover',
      isCut,
    )
  return withCutOpacity('hover:bg-item-hover', isCut)
}

export function folderItemOutlineClass({ isSelected = false }: SidebarItemVisualState = {}):
  | string
  | undefined {
  return isSelected ? 'ring-item-selected-outline' : undefined
}

export function folderItemFolderFillClass({
  isSelected = false,
  isViewing = false,
  isMultiSelected = false,
}: SidebarItemVisualState = {}): string {
  if (isViewing && isMultiSelected)
    return 'fill-item-card-viewing group-focus-within/sidebar-surface:fill-item-card-selected-focus-hover'
  if (isViewing) return 'fill-item-card-viewing'
  if (isSelected)
    return 'fill-item-card-selected group-focus-within/sidebar-surface:fill-item-card-selected-focus'
  return 'fill-card'
}
