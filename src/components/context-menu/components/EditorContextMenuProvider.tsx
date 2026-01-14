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
import { useSidebarItemShares } from '~/hooks/useSidebarItemShares'

interface ProviderProps {
  viewContext: ViewContext
  item?: AnySidebarItem
  children: React.ReactNode
}

export function EditorContextMenuProvider({
  viewContext,
  item,
  children,
}: ProviderProps) {
  const menuActions = useMenuActions()
  const { campaignWithMembership } = useCampaign()
  const { currentSession } = useSession()
  const { mapId, pinnedItemIds, pinId } = useMapView()
  const shareState = useSidebarItemShares(item?._id)

  const menuContext = useMemo(
    () => ({
      item,
      viewContext,
      currentUserId: campaignWithMembership.data?.member.userId,
      memberRole: campaignWithMembership.data?.member.role,
      activeMapId: mapId ?? undefined,
      pinnedItemIds,
      pinId: pinId ?? undefined,
      mapId: mapId ?? undefined,
      hasActiveSession: !!currentSession.data,
      shareState,
    }),
    [
      item,
      viewContext,
      campaignWithMembership.data?.member.userId,
      campaignWithMembership.data?.member.role,
      mapId,
      pinnedItemIds,
      pinId,
      currentSession.data,
      shareState,
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
