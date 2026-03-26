import React from 'react'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import { createMenuItems } from '../menu-registry'
import { useMenuActions } from '../actions'
import { MenuDialogs } from '../menu-dialogs'
import { buildMenu } from '../menu-builder'
import { EditorContextMenuContext } from '../hooks/useEditorContextMenu'
import { VIEW_CONTEXT } from '../constants'
import { PlaceHolderContextMenu } from './empty-context-menu'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { ViewContext } from '../types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSession } from '~/features/sidebar/hooks/useGameSession'
import { useMapViewOptional } from '~/features/editor/hooks/useMapView'
import { useBlockNoteContextMenuOptional } from '~/features/editor/hooks/useBlockNoteContextMenu'

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
  const isItemTrashed = item?.location === SIDEBAR_ITEM_LOCATION.trash

  const menuContext = {
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
  }

  const allMenuItems = createMenuItems(menuActions.actions)
  const menuItems = buildMenu(allMenuItems, menuContext).flatItems

  const contextValue = { menuItems, menuContext }

  return (
    <EditorContextMenuContext.Provider value={contextValue}>
      <PlaceHolderContextMenu>{children}</PlaceHolderContextMenu>
      <MenuDialogs {...menuActions.dialogState} />
    </EditorContextMenuContext.Provider>
  )
}
