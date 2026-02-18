import React, { useMemo } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useQuery } from '@tanstack/react-query'
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
  const shareState = useSidebarItemShares(item?._id)
  const { editor, blockId } = useBlockNoteContextMenu()

  const sidebarItemWithContent = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItem,
      item
        ? { id: item._id, campaignId: item.campaignId }
        : 'skip',
    ),
  )

  const permissionLevel = item?.myPermissionLevel

  const menuContext = useMemo(
    () => ({
      item: sidebarItemWithContent.data ?? undefined,
      viewContext,
      currentUserId: campaignWithMembership.data?.member.userId,
      memberRole: campaignWithMembership.data?.member.role,
      permissionLevel,
      activeMap: activeMap ?? undefined,
      activePin: activePin ?? undefined,
      hasActiveSession: !!currentSession.data,
      shareState,
      editor: editor ?? undefined,
      blockId,
    }),
    [
      sidebarItemWithContent.data,
      viewContext,
      campaignWithMembership.data?.member.userId,
      campaignWithMembership.data?.member.role,
      permissionLevel,
      activeMap,
      activePin,
      currentSession.data,
      shareState,
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
