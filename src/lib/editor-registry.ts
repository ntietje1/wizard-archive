import type { AnySidebarItem, SidebarItemType } from 'convex/sidebarItems/types'
import type { ComponentType } from 'react'

export interface EditorViewerProps<T extends AnySidebarItem> {
  item: T
  search?: unknown
}

type EditorItemConfig<T extends SidebarItemType> = {
  component: ComponentType<
    EditorViewerProps<Extract<AnySidebarItem, { type: T }>>
  >
  showPageBar?: boolean
}

type EditorDefaults = {
  [K in SidebarItemType]: EditorItemConfig<K>
}

let defaults: EditorDefaults | null = null

export function registerDefaults(config: EditorDefaults) {
  defaults = config
}

export function getEditorConfig<T extends SidebarItemType>(
  itemType: T,
): EditorItemConfig<T> | null {
  return (defaults?.[itemType] as EditorItemConfig<T> | undefined) ?? null
}

export function getViewerComponent(
  itemType: SidebarItemType,
): ComponentType<EditorViewerProps<AnySidebarItem>> | null {
  const config = getEditorConfig(itemType)
  if (!config) return null
  return config.component
}

export function shouldShowPageBar(itemType: SidebarItemType): boolean {
  return getEditorConfig(itemType)?.showPageBar ?? false
}
