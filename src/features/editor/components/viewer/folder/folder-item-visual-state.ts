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
      'bg-muted-foreground/16 dark:bg-muted/75 group-focus-within/sidebar-surface:bg-primary/22 group-focus-within/sidebar-surface:dark:bg-primary/34',
      isCut,
    )
  if (isViewing) return withCutOpacity('bg-muted-foreground/16 dark:bg-muted/75', isCut)
  if (isSelected)
    return withCutOpacity(
      'bg-muted-foreground/16 hover:bg-muted-foreground/14 dark:bg-muted/75 dark:hover:bg-muted/80 group-focus-within/sidebar-surface:bg-primary/18 group-focus-within/sidebar-surface:hover:bg-primary/22 group-focus-within/sidebar-surface:dark:bg-primary/28 group-focus-within/sidebar-surface:dark:hover:bg-primary/34',
      isCut,
    )
  return withCutOpacity('hover:bg-muted-foreground/6 dark:hover:bg-muted/50', isCut)
}

export function folderItemOutlineClass({ isSelected = false }: SidebarItemVisualState = {}):
  | string
  | undefined {
  return isSelected ? 'ring-primary/70 dark:ring-primary/80' : undefined
}

export function folderItemFolderFillClass({
  isSelected = false,
  isViewing = false,
  isMultiSelected = false,
}: SidebarItemVisualState = {}): string {
  if (isViewing && isMultiSelected)
    return 'fill-muted-foreground/16 dark:fill-muted/75 group-focus-within/sidebar-surface:fill-primary/22 group-focus-within/sidebar-surface:dark:fill-primary/34'
  if (isViewing) return 'fill-muted-foreground/16 dark:fill-muted/75'
  if (isSelected)
    return 'fill-muted-foreground/16 dark:fill-muted/75 group-focus-within/sidebar-surface:fill-primary/18 group-focus-within/sidebar-surface:dark:fill-primary/28'
  return 'fill-card'
}
