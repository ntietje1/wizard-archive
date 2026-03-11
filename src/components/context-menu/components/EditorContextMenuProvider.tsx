import React, { useMemo } from 'react'
import { createMenuItems } from '../menu-registry'
import { useMenuActions } from '../actions'
import { buildMenu } from '../menu-builder'
import { EditorContextMenuContext } from '../hooks/useEditorContextMenu'
import { PlaceHolderContextMenu } from './EmptyContextMenu'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { ViewContext } from '../types'
import { useCampaign } from '~/hooks/useCampaign'
import { useSession } from '~/hooks/useGameSession'
import { useMapView } from '~/hooks/useMapView'
import { useBlockNoteContextMenu } from '~/hooks/useBlockNoteContextMenu'

interface ProviderProps {
  viewContext: ViewContext
  item?: AnySidebarItem
  isTrashView?: boolean
  children: React.ReactNode
  onDialogOpen?: () => void
  onDialogClose?: () => void
}

export function EditorContextMenuProvider({
  viewContext,
  item,
  isTrashView,
  children,
  onDialogOpen,
  onDialogClose,
}: ProviderProps) {
  const menuActions = useMenuActions({ onDialogOpen, onDialogClose })
  const { campaign } = useCampaign()
  const { currentSession } = useSession()
  const { activeMap, activePin } = useMapView()
  const { editor, blockId } = useBlockNoteContextMenu()

  const permissionLevel = item?.myPermissionLevel
  const isItemTrashed = !!item?.deletionTime

  const menuContext = useMemo(
    () => ({
      item,
      viewContext,
      isItemTrashed,
      isTrashView: isTrashView || viewContext === 'trash-view',
      currentUserId: campaign.data?.myMembership?.userId,
      memberRole: campaign.data?.myMembership?.role,
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
      isItemTrashed,
      isTrashView,
      campaign.data?.myMembership?.userId,
      campaign.data?.myMembership?.role,
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
      {Dialogs}
    </EditorContextMenuContext.Provider>
  )
}
