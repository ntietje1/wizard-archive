import { createContext, useContext } from 'react'
import type { ActionHandlers } from '../menu-registry'
import type { MenuItemDef } from '../types'

interface EditorContextMenuContextValue {
  menuItems: Array<MenuItemDef>
  actions: ActionHandlers
  Dialogs: React.ComponentType
}

export const EditorContextMenuContext =
  createContext<EditorContextMenuContextValue | null>(null)

export function useEditorMenuItems() {
  const ctx = useContext(EditorContextMenuContext)
  if (!ctx) throw new Error('useMenuItems must be within ContextMenuProvider')
  return ctx
}
