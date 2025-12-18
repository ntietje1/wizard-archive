import type { AnySidebarItem, SidebarItemType } from 'convex/sidebarItems/types'
import type { ComponentType } from 'react'

export interface EditorViewerProps<T extends AnySidebarItem> {
  item: T
  search?: unknown
}

export interface EditorItemConfig {
  component: ComponentType<EditorViewerProps<AnySidebarItem>>
  showPageBar?: boolean
}

type EditorDefaults = Record<SidebarItemType, EditorItemConfig>

let defaults: EditorDefaults | null = null

export function registerDefaults(config: EditorDefaults) {
  defaults = config
}

export function getEditorConfig(
  itemType: SidebarItemType,
): EditorItemConfig | null {
  return defaults?.[itemType] ?? null
}

export function getViewerComponent(
  itemType: SidebarItemType,
): ComponentType<EditorViewerProps<AnySidebarItem>> | null {
  return getEditorConfig(itemType)?.component ?? null
}

export function shouldShowPageBar(itemType: SidebarItemType): boolean {
  return getEditorConfig(itemType)?.showPageBar ?? false
}
