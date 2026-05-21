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
import { use, useRef } from 'react'
import type { Ref } from 'react'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useMapViewOptional } from '~/features/editor/hooks/useMapView'
import { BlockNoteContextMenuContext } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { useSession } from '~/features/sidebar/hooks/useGameSession'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { resolveClickedSidebarOperationItems } from '~/features/filesystem/filesystem-operation-selection'
import { useFileSystemReadModel } from '~/features/filesystem/useFileSystemReadModel'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useCampaignMembers } from '~/features/players/hooks/useCampaignMembers'
import { CAMPAIGN_MEMBER_ROLE } from '~/features/campaigns/campaign-types'

interface EditorContextMenuProps {
  ref?: Ref<ContextMenuHostRef>
  viewContext: ViewContext
  item?: AnySidebarItem
  isTrashView?: boolean
  children?: React.ReactNode
  className?: string
  menuClassName?: string
  disabled?: boolean
  onClose?: () => void
  onDialogOpen?: () => void
  onDialogClose?: () => void
}

export function EditorContextMenu({
  ref,
  viewContext,
  item,
  isTrashView,
  children,
  className,
  menuClassName = 'w-48 z-[9999]',
  disabled = false,
  onClose,
  onDialogOpen,
  onDialogClose,
}: EditorContextMenuProps) {
  const fallbackRef = useRef<ContextMenuHostRef>(null)
  const hostRef = ref ?? fallbackRef
  const menuActions = useMenuActions({ onDialogOpen, onDialogClose })
  const { campaign } = useCampaign()
  const { currentSession } = useSession()
  const mapView = useMapViewOptional()
  const blockNoteContext = use(BlockNoteContextMenuContext)
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const filesystemReadModel = useFileSystemReadModel()
  const editorMode = useEditorMode()
  const campaignMembersQuery = useCampaignMembers()
  const playerMembers =
    campaignMembersQuery.data?.filter((member) => member.role === CAMPAIGN_MEMBER_ROLE.Player) ?? []
  // Item selection is intentionally scoped to sidebar, folder, and trash surfaces.
  // Update this when adding a VIEW_CONTEXT that should share filesystem selection.
  const canUseItemSelection =
    viewContext === VIEW_CONTEXT.SIDEBAR ||
    viewContext === VIEW_CONTEXT.FOLDER_VIEW ||
    viewContext === VIEW_CONTEXT.TRASH_VIEW
  const selectedItems = resolveClickedSidebarOperationItems({
    item,
    selectedItemIds,
    activeItemsMap: filesystemReadModel.activeItemsById,
    trashedItemsMap: filesystemReadModel.trashedItemsById,
    canUseItemSelection,
  })
  const primaryItem = selectedItems[0] ?? item

  const menuContext = {
    surface: viewContext,
    item,
    primaryItem,
    selectedItems,
    isItemTrashed: item?.isTrashed === true,
    isTrashView: isTrashView || viewContext === VIEW_CONTEXT.TRASH_VIEW,
    currentUserId: campaign.data?.myMembership?.userId,
    memberRole: campaign.data?.myMembership?.role,
    permissionLevel: item?.myPermissionLevel,
    activeMap: mapView?.activeMap ?? undefined,
    activePin: mapView?.activePin ?? undefined,
    hasActiveSession: !!currentSession.data,
    editor: blockNoteContext?.editor ?? undefined,
    blockNoteId: blockNoteContext?.blockNoteId,
    valueInlineId: blockNoteContext?.valueInlineId,
    valueInlineInstanceId: blockNoteContext?.valueInlineInstanceId,
    valueInlineEditable: blockNoteContext?.valueInlineEditable,
    openValueInline: blockNoteContext?.openValueInline,
  }

  const menu = buildMenu({
    context: menuContext,
    services: {
      actions: menuActions.actions,
      filesystem: menuActions.filesystem,
      editorMode,
      viewAsPlayer: {
        viewAsPlayerId: editorMode.viewAsPlayerId,
        playerMembers,
        setViewAsPlayerId: editorMode.setViewAsPlayerId,
      },
    },
    contributors: editorContextMenuContributors,
    commands: editorContextMenuCommands,
    groupConfig,
  })

  return (
    <>
      {disabled ? (
        children
      ) : (
        <>
          <ContextMenuHost
            ref={hostRef}
            menu={menu}
            className={className}
            menuClassName={menuClassName}
            onClose={onClose}
          >
            {children}
          </ContextMenuHost>
          <MenuDialogs {...menuActions.dialogState} />
        </>
      )}
    </>
  )
}
