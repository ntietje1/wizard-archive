import React, { useMemo } from 'react'
import { createMenuItems } from '../menu-registry'
import { useMenuActions } from '../actions'
import { buildMenu } from '../menu-builder'
import { EditorContextMenuContext } from '../hooks/useEditorContextMenu'
import { VIEW_CONTEXT } from '../constants'
import { PlaceHolderContextMenu } from './EmptyContextMenu'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { ViewContext } from '../types'
import { useCampaign } from '~/hooks/useCampaign'
import { useSession } from '~/hooks/useGameSession'
import { useMapViewOptional } from '~/hooks/useMapView'
import { useBlockNoteContextMenuOptional } from '~/hooks/useBlockNoteContextMenu'

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
  const mapView = useMapViewOptional()
  const blockNoteCtx = useBlockNoteContextMenuOptional()

  const permissionLevel = item?.myPermissionLevel
  const isItemTrashed = !!item?.deletionTime

  const menuContext = useMemo(
    () => ({
      item,
      viewContext,
      isItemTrashed,
      isTrashView: isTrashView || viewContext === VIEW_CONTEXT.TRASH_VIEW,
      currentUserId: campaign.data?.myMembership?.userId,
      memberRole: campaign.data?.myMembership?.role,
      permissionLevel,
      activeMap: mapView?.activeMap ?? undefined,
      activePin: mapView?.activePin ?? undefined,
      hasActiveSession: !!currentSession.data,
      editor: blockNoteCtx?.editor ?? undefined,
      blockId: blockNoteCtx?.blockId,
    }),
    [
      item,
      viewContext,
      isItemTrashed,
      isTrashView,
      campaign.data?.myMembership?.userId,
      campaign.data?.myMembership?.role,
      permissionLevel,
      mapView?.activeMap,
      mapView?.activePin,
      currentSession.data,
      blockNoteCtx?.editor,
      blockNoteCtx?.blockId,
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
