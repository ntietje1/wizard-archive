import { createContext, useCallback, useContext } from 'react'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { ActionHandlers } from '../menu-registry'
import type { MenuContext, MenuItemDef, ViewContext } from '../types'
import { useCampaign } from '~/hooks/useCampaign'
import { useSession } from '~/hooks/useSession'
import { useMapView } from '~/hooks/useMapView'
import { useSidebarItemShares } from '~/hooks/useSidebarItemShares'

interface UseContextMenuOptions {
  viewContext: ViewContext
  item?: AnySidebarItem
}

interface EditorContextMenuContextValue {
  menuItems: Array<MenuItemDef>
  actions: ActionHandlers
  Dialogs: React.ComponentType
}

export const EditorContextMenuContext =
  createContext<EditorContextMenuContextValue | null>(null)

export function useEditorMenuItems() {
  const ctx = useContext(EditorContextMenuContext)
  if (!ctx)
    throw new Error(
      'useEditorMenuItems must be within EditorContextMenuProvider',
    )
  return ctx
}

export function useBuildMenuContext(options: UseContextMenuOptions) {
  const { campaignWithMembership } = useCampaign()
  const { currentSession } = useSession()
  const { mapId, pinnedItemIds, pinId } = useMapView()
  const shareState = useSidebarItemShares(options.item?._id)

  const buildContext = useCallback((): MenuContext | null => {
    const context: MenuContext = {
      item: options.item,
      viewContext: options.viewContext,

      currentUserId: campaignWithMembership.data?.member.userId,
      memberRole: campaignWithMembership.data?.member.role,

      activeMapId: mapId ?? undefined,
      pinnedItemIds,
      pinId: pinId ?? undefined,
      mapId: mapId ?? undefined,

      hasActiveSession: !!currentSession.data,

      shareState,
    }

    return context
  }, [
    options.item,
    options.viewContext,
    shareState,
    campaignWithMembership.data?.member.userId,
    campaignWithMembership.data?.member.role,
    mapId,
    pinnedItemIds,
    pinId,
    currentSession.data,
  ])

  return buildContext
}
