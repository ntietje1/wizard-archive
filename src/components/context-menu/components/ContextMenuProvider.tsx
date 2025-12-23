import React, { createContext, useContext, useMemo } from 'react'
import {  createMenuItems } from '../menu-registry'
import { useMenuActions } from '../actions'
import type {ActionHandlers} from '../menu-registry';
import type { MenuItemDef } from '../types'

interface ContextMenuContextValue {
  menuItems: Array<MenuItemDef>
  actions: ActionHandlers
  Dialogs: React.ComponentType
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null)

export function useMenuItems() {
  const ctx = useContext(ContextMenuContext)
  if (!ctx) throw new Error('useMenuItems must be within ContextMenuProvider')
  return ctx
}

interface ProviderProps {
  children: React.ReactNode
}

export function ContextMenuProvider({ children }: ProviderProps) {
  const menuActions = useMenuActions()

  const value = useMemo(
    () => ({
      menuItems: createMenuItems(menuActions.actions),
      actions: menuActions.actions,
      Dialogs: menuActions.Dialogs,
    }),
    [menuActions],
  )

  const { Dialogs } = menuActions

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      <Dialogs />
    </ContextMenuContext.Provider>
  )
}
