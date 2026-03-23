import { createContext, useContext } from 'react'
import type { MenuContext, MenuItemDef } from '../types'

interface EditorContextMenuContextValue {
  menuItems: Array<MenuItemDef>
  menuContext: MenuContext
}

export const EditorContextMenuContext =
  createContext<EditorContextMenuContextValue | null>(null)

export function useEditorContextMenu() {
  const ctx = useContext(EditorContextMenuContext)
  if (!ctx)
    throw new Error(
      'useEditorContextMenu must be within EditorContextMenuProvider',
    )
  return ctx
}
