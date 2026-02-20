import React, { useMemo } from 'react'
import { createMenuItems } from '../menu-registry'
import { useMenuActions } from '../actions'
import { buildMenu } from '../menu-builder'
import { EditorContextMenuContext } from '../hooks/useEditorContextMenu'
import { PlaceHolderContextMenu } from './EmptyContextMenu'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { ViewContext } from '../types'
import { useCampaign } from '~/hooks/useCampaign'
import { useSession } from '~/hooks/useSession'
import { useMapView } from '~/hooks/useMapView'
import { useBlockNoteContextMenu } from '~/hooks/useBlockNoteContextMenu'

interface ProviderProps {
  viewContext: ViewContext
  item?: AnySidebarItem
  children: React.ReactNode
  onDialogOpen?: () => void
  onDialogClose?: () => void
}

export function EditorContextMenuProvider({
  viewContext,
  item,
  children,
  onDialogOpen,
  onDialogClose,
}: ProviderProps) {
  const menuActions = useMenuActions({ onDialogOpen, onDialogClose })
  const { campaignWithMembership } = useCampaign()
  const { currentSession } = useSession()
  const { activeMap, activePin } = useMapView()
  const { editor, blockId } = useBlockNoteContextMenu()

  const permissionLevel = item?.myPermissionLevel

  const menuContext = useMemo(
    () => ({
      item,
      viewContext,
      currentUserId: campaignWithMembership.data?.member.userId,
      memberRole: campaignWithMembership.data?.member.role,
      permissionLevel,
      activeMap: activeMap ?? undefined,
      activePin: activePin ?? undefined,
      hasActiveSession: !!currentSession.data,
      editor: editor ?? undefined,
      blockId,
    }),
    [
      item,
      viewContext,
      campaignWithMembership.data?.member.userId,
      campaignWithMembership.data?.member.role,
      permissionLevel,
      activeMap,
      activePin,
      currentSession.data,
      editor,
      blockId,
    ],
  )

  const menuItems = useMemo(() => {
    const allMenuItems = createMenuItems(menuActions.actions)
    return buildMenu(allMenuItems, menuContext).flatItems
  }, [menuActions.actions, menuContext])

  const { Dialogs } = menuActions

  const contextValue = useMemo(
    () => ({ menuItems, menuContext }),
    [menuItems, menuContext],
  )

  return (
    <EditorContextMenuContext.Provider value={contextValue}>
      <PlaceHolderContextMenu>{children}</PlaceHolderContextMenu>
      <Dialogs />
    </EditorContextMenuContext.Provider>
  )
}
