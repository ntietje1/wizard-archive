import { createElement, use, useEffect, useRef, useState } from 'react'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { useLiveEditorContextMenuActions } from './use-live-editor-context-menu-actions'
import { VIEW_CONTEXT } from '../constants'
import { buildMenu } from '../menu-builder'
import {
  editorContextMenuCommands,
  editorContextMenuContributors,
  groupConfig,
} from '../menu-registry'
import type { ContextMenuHostRef } from '../components/context-menu-host'
import type { EditorContextMenuSurfaceModel } from '../components/editor-context-menu-surface'
import type { MenuDialogState } from '../menu-dialogs'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { EditorMenuContext, ViewContext } from '../types'
import type { GameMapWithContent, MapPinWithItem } from 'shared/game-maps/types'
import type { Ref } from 'react'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useMapViewOptional } from '~/features/editor/hooks/useMapView'
import { BlockNoteContextMenuContext } from '~/features/editor/hooks/useBlockNoteContextMenu'
import type { BlockNoteContextMenuContextType } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { RIGHT_SIDEBAR_CONTENT } from '~/features/editor/chrome/right-sidebar-content'
import type { RightSidebarContentId } from '~/features/editor/chrome/right-sidebar-content'
import { RIGHT_SIDEBAR_PANEL_ID } from '~/features/editor/components/right-sidebar/constants'
import {
  canShowRightSidebarContent,
  resolveRightSidebarContent,
} from '~/features/editor/components/right-sidebar/right-sidebar-model'
import { RIGHT_SIDEBAR_PANELS } from '~/features/editor/components/right-sidebar/right-sidebar-registry'
import { useRightSidebarStateStore } from '~/features/editor/stores/right-sidebar-state-store'
import { useSession } from '~/features/sidebar/hooks/useGameSession'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import { resolveClickedSidebarOperationItems } from '~/features/filesystem/filesystem-operation-selection'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import { getBlockShareTargetBlocks } from '~/features/editor/utils/block-share-targets'
import { useCampaignActorPermissions } from '~/features/campaigns/hooks/useCampaignActorPermissions'
import { useBlocksShare } from '~/features/sharing/hooks/useBlocksShare'
import { SidebarItemsSharePanel } from '~/features/sharing/components/sidebar-items-share-panel'
import { usePanelPreferenceStore } from '~/features/settings/stores/panel-preference-store'

const FILESYSTEM_SELECTION_SURFACES = new Set<ViewContext>([
  VIEW_CONTEXT.SIDEBAR,
  VIEW_CONTEXT.FOLDER_VIEW,
  VIEW_CONTEXT.TRASH_VIEW,
])

type BlockShareAllPlayersPermissionLevel = 'hidden' | 'visible' | 'mixed'

interface OptimisticBlockSharePermission {
  targetKey: string
  permissionLevel: Exclude<BlockShareAllPlayersPermissionLevel, 'mixed'>
}

interface LiveEditorContextMenuModel {
  dialogState: MenuDialogState
  surfaceModel: EditorContextMenuSurfaceModel
}

interface LiveEditorContextMenuModelOptions {
  activeMap?: GameMapWithContent
  activePin?: MapPinWithItem
  isTrashView?: boolean
  item?: AnySidebarItem
  onDialogClose?: () => void
  onDialogOpen?: () => void
  ref?: Ref<ContextMenuHostRef>
  viewContext: ViewContext
}

export function useLiveEditorContextMenuModel({
  ref,
  viewContext,
  item,
  isTrashView,
  activeMap,
  activePin,
  onDialogOpen,
  onDialogClose,
}: LiveEditorContextMenuModelOptions): LiveEditorContextMenuModel {
  const fallbackRef = useRef<ContextMenuHostRef>(null)
  const hostRef = ref ?? fallbackRef
  const menuActions = useLiveEditorContextMenuActions({ onDialogOpen, onDialogClose })
  const { campaign } = useCampaign()
  const { currentSession } = useSession()
  const mapView = useMapViewOptional()
  const blockNoteContext = use(BlockNoteContextMenuContext)
  const {
    items,
    selection: { selectedItemIds },
  } = useSidebarWorkspaceSource()
  const editorMode = useEditorMode()
  const actorPermissions = useCampaignActorPermissions()
  const campaignMembersQuery = useCampaignMembers()
  const blockShareTargets = getBlockShareTargetsFromContext(blockNoteContext)
  const blockShare = useBlocksShare(blockShareTargets.blocks, blockShareTargets.note)
  const blockShareTargetKey = getBlockShareTargetKey(
    blockShareTargets,
    blockShare.allPlayersPermissionLevel,
  )
  const [optimisticBlockSharePermission, setOptimisticBlockSharePermission] =
    useState<OptimisticBlockSharePermission | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const displayedAllPlayersPermissionLevel =
    optimisticBlockSharePermission?.targetKey === blockShareTargetKey
      ? optimisticBlockSharePermission.permissionLevel
      : blockShare.allPlayersPermissionLevel
  const optimisticBlockShareIsPending =
    optimisticBlockSharePermission?.targetKey === blockShareTargetKey
  const canToggleBlockShare =
    blockShare.hasCompleteData && !blockShare.isMutating && !optimisticBlockShareIsPending
  const playerMembers =
    campaignMembersQuery.data?.filter((member) => member.role === CAMPAIGN_MEMBER_ROLE.Player) ?? []
  const selectedItems = resolveClickedSidebarOperationItems({
    item,
    selectedItemIds,
    activeItemsMap: items.active.itemsMap,
    trashedItemsMap: items.trash.itemsMap,
    canUseItemSelection: canUseItemSelection(viewContext),
  })
  const primaryItem = selectedItems[0] ?? item
  const actionItem = item ? actorPermissions.projectActionItem(item) : undefined
  const actionPrimaryItem = primaryItem
    ? actorPermissions.projectActionItem(primaryItem)
    : undefined
  const actionSelectedItems = selectedItems.map(actorPermissions.projectActionItem)

  const menuContext = buildEditorMenuContext({
    blockNoteContext,
    campaign,
    currentSession,
    item: actionItem,
    isViewingAsPlayer: editorMode.viewAsPlayerId !== undefined,
    isTrashView,
    mapView,
    activeMap,
    activePin,
    primaryItem: actionPrimaryItem,
    selectedItems: actionSelectedItems,
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
      sidebarItemSharing: {
        renderSidebarItemsSharePanel: (shareItems) =>
          createElement(SidebarItemsSharePanel, { items: shareItems }),
      },
      blockShare: {
        canOpen: (context) =>
          blockShare.canShare &&
          blockShare.hasCompleteData &&
          getContextMenuBlockShareTargets(context).length > 0,
        canToggleAllPlayersPermission: () => canToggleBlockShare,
        getBlockCount: (context) => getContextMenuBlockShareTargets(context).length,
        getAllPlayersPermissionLevel: () => displayedAllPlayersPermissionLevel,
        toggleAllPlayersPermission: () => {
          if (!canToggleBlockShare) return
          const nextPermission =
            displayedAllPlayersPermissionLevel === 'visible' ? 'hidden' : 'visible'
          setOptimisticBlockSharePermission({
            targetKey: blockShareTargetKey,
            permissionLevel: nextPermission,
          })
          void blockShare.setAllPlayersPermission(nextPermission).then((updated) => {
            if (!updated && isMountedRef.current) {
              setOptimisticBlockSharePermission(null)
            }
          })
        },
      },
      editorPanels: {
        getPanelItems: (context) => {
          if (!context.item) return []
          return RIGHT_SIDEBAR_PANELS.filter((panel) =>
            canShowRightSidebarContent(context.item?.type, panel.id),
          ).map((panel) => ({
            id: panel.id,
            label: panel.label === 'History' ? 'Edit History' : panel.label,
            icon: panel.icon,
          }))
        },
        isPanelActive: (context, panelId) => {
          if (!context.item || !isRightSidebarContentId(panelId)) return false
          if (!canShowRightSidebarContent(context.item.type, panelId)) return false
          const panel = usePanelPreferenceStore.getState().panels[RIGHT_SIDEBAR_PANEL_ID]
          const activeContentId = resolveRightSidebarContent(
            context.item.type,
            useRightSidebarStateStore.getState().activeContentByItemType[context.item.type],
          )
          return panel?.visible === true && activeContentId === panelId
        },
        activatePanel: (context, panelId) => {
          if (!context.item || !isRightSidebarContentId(panelId)) return
          if (!canShowRightSidebarContent(context.item.type, panelId)) return
          useRightSidebarStateStore.getState().setActiveContent(context.item.type, panelId)
          usePanelPreferenceStore.getState().setVisible(RIGHT_SIDEBAR_PANEL_ID, true)
        },
      },
    },
    contributors: editorContextMenuContributors,
    commands: editorContextMenuCommands,
    groupConfig,
  })

  return {
    dialogState: menuActions.dialogState,
    surfaceModel: { hostRef, menu },
  }
}

function canUseItemSelection(viewContext: ViewContext) {
  return FILESYSTEM_SELECTION_SURFACES.has(viewContext)
}

function buildEditorMenuContext({
  blockNoteContext,
  campaign,
  currentSession,
  item,
  isViewingAsPlayer,
  isTrashView,
  mapView,
  activeMap,
  activePin,
  primaryItem,
  selectedItems,
  viewContext,
}: {
  blockNoteContext: BlockNoteContextMenuContextType | null
  campaign: ReturnType<typeof useCampaign>['campaign']
  currentSession: ReturnType<typeof useSession>['currentSession']
  item?: AnySidebarItem
  isViewingAsPlayer?: boolean
  isTrashView?: boolean
  mapView: ReturnType<typeof useMapViewOptional>
  activeMap?: GameMapWithContent
  activePin?: MapPinWithItem
  primaryItem?: AnySidebarItem
  selectedItems: Array<AnySidebarItem>
  viewContext: ViewContext
}) {
  const membershipContext = getCampaignMembershipContext(campaign)
  const mapContext = getMapMenuContext({ mapView, activeMap, activePin })
  const blockNoteMenuContext = getBlockNoteMenuContext(blockNoteContext)

  return {
    surface: viewContext,
    item,
    primaryItem,
    selectedItems,
    isItemTrashed: itemIsTrashed(item),
    isTrashView: isTrashSurface({ explicitTrashView: isTrashView, viewContext }),
    ...membershipContext,
    isViewingAsPlayer,
    permissionLevel: item?.myPermissionLevel,
    ...mapContext,
    hasActiveSession: sessionIsActive(currentSession),
    ...blockNoteMenuContext,
  }
}

function itemIsTrashed(item?: AnySidebarItem) {
  return item?.isTrashed === true
}

function isTrashSurface({
  explicitTrashView,
  viewContext,
}: {
  explicitTrashView?: boolean
  viewContext: ViewContext
}) {
  return explicitTrashView === true || viewContext === VIEW_CONTEXT.TRASH_VIEW
}

function getCampaignMembershipContext(campaign: ReturnType<typeof useCampaign>['campaign']) {
  const membership = campaign.data?.myMembership

  return {
    currentUserId: membership?.userId,
    memberRole: membership?.role,
  }
}

function getMapMenuContext({
  mapView,
  activeMap,
  activePin,
}: {
  mapView: ReturnType<typeof useMapViewOptional>
  activeMap?: GameMapWithContent
  activePin?: MapPinWithItem
}) {
  const context: Partial<Pick<EditorMenuContext, 'activeMap' | 'activePin'>> = {}
  const resolvedActiveMap = activeMap ?? mapView?.activeMap
  const resolvedActivePin = activePin ?? mapView?.activePin

  if (resolvedActiveMap != null) {
    context.activeMap = resolvedActiveMap
  }
  if (resolvedActivePin != null) {
    context.activePin = resolvedActivePin
  }
  return context
}

function sessionIsActive(currentSession: ReturnType<typeof useSession>['currentSession']) {
  return Boolean(currentSession.data)
}

function getBlockNoteMenuContext(blockNoteContext: BlockNoteContextMenuContextType | null) {
  if (!blockNoteContext) {
    return {}
  }

  return {
    note: blockNoteContext.note,
    editor: blockNoteContext.editor ?? undefined,
    position: blockNoteContext.position,
    blockNoteId: blockNoteContext.blockNoteId,
    isEditorTextContext: blockNoteContext.isEditorTextContext,
    valueInlineId: blockNoteContext.valueInlineId,
    valueInlineInstanceId: blockNoteContext.valueInlineInstanceId,
    valueInlineEditable: blockNoteContext.valueInlineEditable,
    openValueInline: blockNoteContext.openValueInline,
  }
}

function getBlockShareTargetsFromContext(blockNoteContext: BlockNoteContextMenuContextType | null) {
  if (!blockNoteContext?.editor) return { blocks: [], note: undefined }
  return {
    blocks: getBlockShareTargetBlocks(blockNoteContext.editor, blockNoteContext.blockNoteId),
    note: blockNoteContext.note,
  }
}

function getBlockShareTargetKey(
  { blocks, note }: ReturnType<typeof getBlockShareTargetsFromContext>,
  permissionLevel: string,
) {
  return `${note?._id ?? 'no-note'}:${blocks.map((block) => block.id).join(',')}:${permissionLevel}`
}

function getContextMenuBlockShareTargets(context: EditorMenuContext) {
  if (!context.editor || !context.note) return []
  return getBlockShareTargetBlocks(context.editor, context.blockNoteId)
}

function isRightSidebarContentId(value: string): value is RightSidebarContentId {
  return Object.values(RIGHT_SIDEBAR_CONTENT).includes(value as RightSidebarContentId)
}
