import React, { useMemo } from 'react'
import { createMenuItems } from '../menu-registry'
import { useMenuActions } from '../actions'
import { ContextMenuContext } from '../hooks/useMenuItems'

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
