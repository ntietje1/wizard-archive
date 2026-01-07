import React, { useMemo } from 'react'
import { createMenuItems } from '../menu-registry'
import { useMenuActions } from '../actions'
import { EditorContextMenuContext } from '../hooks/useEditorMenuItems'
import { PlaceHolderContextMenu } from './EmptyContextMenu'

interface ProviderProps {
  children: React.ReactNode
}

export function EditorContextMenuProvider({ children }: ProviderProps) {
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
    <EditorContextMenuContext.Provider value={value}>
      <PlaceHolderContextMenu>{children}</PlaceHolderContextMenu>
      <Dialogs />
    </EditorContextMenuContext.Provider>
  )
}
