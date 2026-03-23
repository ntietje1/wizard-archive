import { createContext, useContext } from 'react'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'

export interface EditorNavigationValue {
  navigateToItem: (
    item: { type: SidebarItemType; slug: string },
    replace?: boolean,
  ) => Promise<void>
  navigateToNote: (slug: string, replace?: boolean) => Promise<void>
  navigateToMap: (slug: string, replace?: boolean) => Promise<void>
  navigateToFolder: (slug: string, replace?: boolean) => Promise<void>
  navigateToFile: (slug: string, replace?: boolean) => Promise<void>
  clearEditorContent: () => Promise<void>
}

export const EditorNavigationContext =
  createContext<EditorNavigationValue | null>(null)

export function useEditorNavigationContext(): EditorNavigationValue {
  const ctx = useContext(EditorNavigationContext)
  if (!ctx) {
    throw new Error(
      'useEditorNavigationContext must be used within an EditorNavigationProvider',
    )
  }
  return ctx
}
