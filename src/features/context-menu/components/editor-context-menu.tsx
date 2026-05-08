import { forwardRef } from 'react'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import { useMenuActions } from '../actions'
import { VIEW_CONTEXT } from '../constants'
import { buildMenu } from '../menu-builder'
import {
  editorContextMenuCommands,
  editorContextMenuContributors,
  groupConfig,
} from '../menu-registry'
import { MenuDialogs } from '../menu-dialogs'
import { ContextMenuHost } from './context-menu-host'
import type { ContextMenuHostRef } from './context-menu-host'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { ViewContext } from '../types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useMapViewOptional } from '~/features/editor/hooks/useMapView'
import { useBlockNoteContextMenuOptional } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { useSession } from '~/features/sidebar/hooks/useGameSession'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useActiveSidebarItems, useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { resolveContextSelectedItems } from '~/features/context-menu/selection-context'

export type EditorContextMenuRef = ContextMenuHostRef

interface EditorContextMenuProps {
  viewContext: ViewContext
  item?: AnySidebarItem
  isTrashView?: boolean
  children?: React.ReactNode
  className?: string
  menuClassName?: string
  onClose?: () => void
  onDialogOpen?: () => void
  onDialogClose?: () => void
}

export const EditorContextMenu = forwardRef<EditorContextMenuRef, EditorContextMenuProps>(
  (
    {
      viewContext,
      item,
      isTrashView,
      children,
      className,
      menuClassName = 'w-48 z-[9999]',
      onClose,
      onDialogOpen,
      onDialogClose,
    },
    ref,
  ) => {
    const menuActions = useMenuActions({ onDialogOpen, onDialogClose })
    const { campaign } = useCampaign()
    const { currentSession } = useSession()
    const mapView = useMapViewOptional()
    const blockNoteContext = useBlockNoteContextMenuOptional()
    const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
    const { itemsMap } = useActiveSidebarItems()
    const { itemsMap: trashedItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
    const canUseItemSelection =
      viewContext === VIEW_CONTEXT.SIDEBAR ||
      viewContext === VIEW_CONTEXT.FOLDER_VIEW ||
      viewContext === VIEW_CONTEXT.TRASH_VIEW
    const selectedItems = resolveContextSelectedItems({
      item,
      selectedItemIds,
      activeItemsMap: itemsMap,
      trashedItemsMap,
      canUseItemSelection,
    })
    const primaryItem = item ?? selectedItems[0]

    const menuContext = {
      surface: viewContext,
      item,
      primaryItem,
      selectedItems,
      isMultiSelection: selectedItems.length > 1,
      isItemTrashed: item?.location === SIDEBAR_ITEM_LOCATION.trash,
      isTrashView: isTrashView || viewContext === VIEW_CONTEXT.TRASH_VIEW,
      currentUserId: campaign.data?.myMembership?.userId,
      memberRole: campaign.data?.myMembership?.role,
      permissionLevel: item?.myPermissionLevel,
      activeMap: mapView?.activeMap ?? undefined,
      activePin: mapView?.activePin ?? undefined,
      hasActiveSession: !!currentSession.data,
      editor: blockNoteContext?.editor ?? undefined,
      blockNoteId: blockNoteContext?.blockNoteId,
    }

    const menu = buildMenu({
      context: menuContext,
      services: { actions: menuActions.actions },
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    return (
      <>
        <ContextMenuHost
          ref={ref}
          menu={menu}
          className={className}
          menuClassName={menuClassName}
          onClose={onClose}
        >
          {children}
        </ContextMenuHost>
        <MenuDialogs {...menuActions.dialogState} />
      </>
    )
  },
)

EditorContextMenu.displayName = 'EditorContextMenu'
