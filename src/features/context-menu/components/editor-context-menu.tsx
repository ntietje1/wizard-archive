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
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { EditorMenuContext, ViewContext } from '../types'
import { use, useRef } from 'react'
import type { Ref } from 'react'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useMapViewOptional } from '~/features/editor/hooks/useMapView'
import { BlockNoteContextMenuContext } from '~/features/editor/hooks/useBlockNoteContextMenu'
import type { BlockNoteContextMenuContextType } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { useSession } from '~/features/sidebar/hooks/useGameSession'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { resolveClickedSidebarOperationItems } from '~/features/filesystem/filesystem-operation-selection'
import { useFileSystemReadModel } from '~/features/filesystem/useFileSystemReadModel'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { useOptionalBlockShareMenu } from '~/features/sharing/contexts/useBlockShareMenu'
import {
  getBlockShareTargetBlocks,
  getBlockShareTitle,
} from '~/features/editor/utils/block-share-targets'

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

const FILESYSTEM_SELECTION_SURFACES = new Set<ViewContext>([
  VIEW_CONTEXT.SIDEBAR,
  VIEW_CONTEXT.FOLDER_VIEW,
  VIEW_CONTEXT.TRASH_VIEW,
])

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
  const { hostRef, menuActions, menu } = useEditorContextMenuModel({
    ref,
    viewContext,
    item,
    isTrashView,
    onDialogOpen,
    onDialogClose,
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

function useEditorContextMenuModel({
  ref,
  viewContext,
  item,
  isTrashView,
  onDialogOpen,
  onDialogClose,
}: {
  ref?: Ref<ContextMenuHostRef>
  viewContext: ViewContext
  item?: AnySidebarItem
  isTrashView?: boolean
  onDialogOpen?: () => void
  onDialogClose?: () => void
}) {
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
  const blockShareMenu = useOptionalBlockShareMenu()
  const campaignMembersQuery = useCampaignMembers()
  const playerMembers =
    campaignMembersQuery.data?.filter((member) => member.role === CAMPAIGN_MEMBER_ROLE.Player) ?? []
  const selectedItems = resolveClickedSidebarOperationItems({
    item,
    selectedItemIds,
    activeItemsMap: filesystemReadModel.activeItemsById,
    trashedItemsMap: filesystemReadModel.trashedItemsById,
    canUseItemSelection: canUseItemSelection(viewContext),
  })
  const primaryItem = selectedItems[0] ?? item

  const menuContext = buildEditorMenuContext({
    blockNoteContext,
    campaign,
    currentSession,
    item,
    isTrashView,
    mapView,
    primaryItem,
    selectedItems,
    viewContext,
  })

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
      blockShare: {
        canOpen: (context) =>
          blockShareMenu !== null && getContextMenuBlockShareTargets(context).length > 0,
        getBlockCount: (context) => getContextMenuBlockShareTargets(context).length,
        open: (context) => {
          const blocks = getContextMenuBlockShareTargets(context)
          if (!blockShareMenu || !context.note || !context.position || blocks.length === 0) return

          blockShareMenu.open({
            blocks,
            note: context.note,
            position: context.position,
            title: getBlockShareTitle(blocks.length),
          })
        },
      },
    },
    contributors: editorContextMenuContributors,
    commands: editorContextMenuCommands,
    groupConfig,
  })

  return { hostRef, menuActions, menu }
}

function canUseItemSelection(viewContext: ViewContext) {
  return FILESYSTEM_SELECTION_SURFACES.has(viewContext)
}

function buildEditorMenuContext({
  blockNoteContext,
  campaign,
  currentSession,
  item,
  isTrashView,
  mapView,
  primaryItem,
  selectedItems,
  viewContext,
}: {
  blockNoteContext: BlockNoteContextMenuContextType | null
  campaign: ReturnType<typeof useCampaign>['campaign']
  currentSession: ReturnType<typeof useSession>['currentSession']
  item?: AnySidebarItem
  isTrashView?: boolean
  mapView: ReturnType<typeof useMapViewOptional>
  primaryItem?: AnySidebarItem
  selectedItems: Array<AnySidebarItem>
  viewContext: ViewContext
}) {
  return {
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
    note: blockNoteContext?.note,
    editor: blockNoteContext?.editor ?? undefined,
    position: blockNoteContext?.position,
    blockNoteId: blockNoteContext?.blockNoteId,
    isEditorTextContext: blockNoteContext?.isEditorTextContext,
    valueInlineId: blockNoteContext?.valueInlineId,
    valueInlineInstanceId: blockNoteContext?.valueInlineInstanceId,
    valueInlineEditable: blockNoteContext?.valueInlineEditable,
    openValueInline: blockNoteContext?.openValueInline,
  }
}

function getContextMenuBlockShareTargets(context: EditorMenuContext) {
  if (!context.editor || !context.note) return []
  return getBlockShareTargetBlocks(context.editor, context.blockNoteId)
}
