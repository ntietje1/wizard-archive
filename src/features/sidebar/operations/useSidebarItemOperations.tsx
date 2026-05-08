import { createContext, use, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { planDuplicateOperations, planMoveOperations } from 'convex/sidebarItems/operations/planner'
import { normalizeTopLevelSelectedItems } from 'convex/sidebarItems/operations/selection'
import { ItemOperationConflictDialog } from './item-operation-conflict-dialog'
import { toDecisionArray } from './operation-decisions'
import { getPasteTargetParentId, getRestoreTargetParentId } from './operation-targets'
import {
  applyOptimisticDuplicateOperationsToSnapshot,
  applyOptimisticPermanentDeleteItemsToSnapshot,
  applyOptimisticMoveOperationsToSnapshot,
  applyOptimisticTrashItemsToSnapshot,
} from './optimistic-cache'
import type { SidebarCacheSnapshot } from './optimistic-cache'
import type {
  ConflictDecision,
  DuplicateOperation,
  ItemOperationConflict,
  MoveOperation,
} from 'convex/sidebarItems/operations/types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { PermanentDeleteConfirmDialog } from '~/features/context-menu/components/dialogs/trash-confirm-dialogs'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarItemsCache } from '~/features/sidebar/hooks/useSidebarItemsCache'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { getSelectedSlug } from '~/features/sidebar/hooks/useSelectedItem'
import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { handleError } from '~/shared/utils/logger'

type PendingDuplicateRequest = {
  items: Array<AnySidebarItem>
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<AnySidebarItem>
  conflicts: Array<ItemOperationConflict>
}

type PendingMoveRequest = PendingDuplicateRequest
type MoveIntentAction = 'move' | 'restore'

export interface SidebarItemOperationsValue {
  selectedItems: Array<AnySidebarItem>
  dialog: ReactNode
  copyItems: (items: Array<AnySidebarItem>) => void
  cutItems: (items: Array<AnySidebarItem>) => void
  pasteClipboard: (targetParentId?: Id<'sidebarItems'> | null) => Promise<void>
  duplicateItems: (
    items: Array<AnySidebarItem>,
    targetParentId?: Id<'sidebarItems'> | null,
  ) => Promise<void>
  moveItems: (
    items: Array<AnySidebarItem>,
    targetParentId?: Id<'sidebarItems'> | null,
  ) => Promise<Array<Id<'sidebarItems'>>>
  restoreItems: (
    items: Array<AnySidebarItem>,
    targetParentId?: Id<'sidebarItems'> | null,
  ) => Promise<Array<Id<'sidebarItems'>>>
  trashItems: (items: Array<AnySidebarItem>) => Promise<Array<Id<'sidebarItems'>>>
  permanentlyDeleteItems: (items: Array<AnySidebarItem>) => Promise<Array<Id<'sidebarItems'>>>
  confirmPermanentDeleteItems: (items: Array<AnySidebarItem>) => void
  normalizeItems: (items: Array<AnySidebarItem>) => Array<AnySidebarItem>
}

export const SidebarItemOperationsContext = createContext<SidebarItemOperationsValue | null>(null)

export function useSidebarItemOperationsValue() {
  const { campaignId } = useCampaign()
  const { parentItemsMap, itemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.sidebar)
  const { itemsMap: trashedItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
  const { clearEditorContent } = useEditorNavigation()
  const moveSidebarItemsMutation = useCampaignMutation(api.sidebarItems.mutations.moveSidebarItems)
  const permanentlyDeleteSidebarItemsMutation = useCampaignMutation(
    api.sidebarItems.mutations.permanentlyDeleteSidebarItems,
  )
  const duplicateSidebarItemsMutation = useCampaignMutation(
    api.sidebarItems.mutations.duplicateSidebarItems,
  )
  const cache = useSidebarItemsCache()
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const activeItemSurface = useSidebarUIStore((s) => s.activeItemSurface)
  const itemClipboard = useSidebarUIStore((s) => s.itemClipboard)
  const setItemClipboard = useSidebarUIStore((s) => s.setItemClipboard)
  const setSelectedItemIds = useSidebarUIStore((s) => s.setSelectedItemIds)
  const [pendingDuplicateRequest, setPendingDuplicateRequest] =
    useState<PendingDuplicateRequest | null>(null)
  const [pendingMoveRequest, setPendingMoveRequest] = useState<PendingMoveRequest | null>(null)
  const [pendingPermanentDeleteItems, setPendingPermanentDeleteItems] =
    useState<Array<AnySidebarItem> | null>(null)

  const allItemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([...itemsMap, ...trashedItemsMap])

  const normalizeItems = (items: Array<AnySidebarItem>) =>
    normalizeTopLevelSelectedItems(items, allItemsMap)

  const resolveItemsById = (ids: Array<Id<'sidebarItems'>>) => {
    const resolvedItems: Array<AnySidebarItem> = []
    for (const id of ids) {
      const item = allItemsMap.get(id)
      if (item) {
        resolvedItems.push(item)
      }
    }
    return resolvedItems
  }

  const selectedItems = normalizeTopLevelSelectedItems(
    resolveItemsById(selectedItemIds),
    allItemsMap,
  )

  const applyCacheSnapshot = (snapshot: SidebarCacheSnapshot) => {
    cache.update(SIDEBAR_ITEM_LOCATION.sidebar, () => snapshot.sidebar)
    cache.update(SIDEBAR_ITEM_LOCATION.trash, () => snapshot.trash)
  }

  const getSnapshot = (): SidebarCacheSnapshot => ({
    sidebar: cache.get(SIDEBAR_ITEM_LOCATION.sidebar),
    trash: cache.get(SIDEBAR_ITEM_LOCATION.trash),
  })

  const applyOptimisticMoveOperations = (
    operations: Array<MoveOperation>,
  ): SidebarCacheSnapshot => {
    const snapshot = getSnapshot()
    applyCacheSnapshot(applyOptimisticMoveOperationsToSnapshot(snapshot, operations))
    return snapshot
  }

  const applyOptimisticDuplicateOperations = (
    operations: Array<DuplicateOperation>,
  ): SidebarCacheSnapshot => {
    const snapshot = getSnapshot()
    applyCacheSnapshot(applyOptimisticDuplicateOperationsToSnapshot(snapshot, operations))
    return snapshot
  }

  const applyOptimisticTrashItems = (items: Array<AnySidebarItem>): SidebarCacheSnapshot => {
    const snapshot = getSnapshot()
    applyCacheSnapshot(applyOptimisticTrashItemsToSnapshot(snapshot, items))
    return snapshot
  }

  const applyOptimisticPermanentDeleteItems = (
    items: Array<AnySidebarItem>,
  ): SidebarCacheSnapshot => {
    const snapshot = getSnapshot()
    applyCacheSnapshot(applyOptimisticPermanentDeleteItemsToSnapshot(snapshot, items))
    return snapshot
  }

  const runDuplicateIntent = async (
    items: Array<AnySidebarItem>,
    targetParentId: Id<'sidebarItems'> | null,
    operations: Array<DuplicateOperation>,
    decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
  ) => {
    if (!campaignId || items.length === 0) return []
    const snapshot = applyOptimisticDuplicateOperations(operations)
    try {
      const createdIds = await duplicateSidebarItemsMutation.mutateAsync({
        sourceItemIds: items.map((item) => item._id),
        targetParentId,
        decisions: toDecisionArray(decisions),
      })
      if (createdIds.length > 0) {
        setSelectedItemIds(createdIds)
      }
      return createdIds
    } catch (error) {
      applyCacheSnapshot(snapshot)
      throw error
    }
  }

  const runMoveIntent = async (
    items: Array<AnySidebarItem>,
    targetParentId: Id<'sidebarItems'> | null,
    operations: Array<MoveOperation>,
    action: MoveIntentAction,
    decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
  ) => {
    if (!campaignId || items.length === 0) return []
    const snapshot = applyOptimisticMoveOperations(operations)
    try {
      const movedIds = await moveSidebarItemsMutation.mutateAsync({
        sourceItemIds: items.map((item) => item._id),
        targetParentId,
        action,
        decisions: toDecisionArray(decisions),
      })
      return movedIds
    } catch (error) {
      applyCacheSnapshot(snapshot)
      throw error
    }
  }

  const handleDuplicatePlanNeedingDecision = (
    items: Array<AnySidebarItem>,
    targetParentId: Id<'sidebarItems'> | null,
    targetItems: Array<AnySidebarItem>,
    conflicts: Array<ItemOperationConflict>,
  ) => {
    setPendingDuplicateRequest({
      items,
      targetParentId,
      targetItems,
      conflicts,
    })
  }

  const handleMovePlanNeedingDecision = (
    items: Array<AnySidebarItem>,
    targetParentId: Id<'sidebarItems'> | null,
    targetItems: Array<AnySidebarItem>,
    conflicts: Array<ItemOperationConflict>,
  ) => {
    setPendingMoveRequest({
      items,
      targetParentId,
      targetItems,
      conflicts,
    })
  }

  const duplicateItems = async (
    items: Array<AnySidebarItem>,
    targetParentId = getPasteTargetParentId(activeItemSurface),
  ) => {
    items = normalizeItems(items)
    if (!campaignId || items.length === 0) return
    const targetItems = parentItemsMap.get(targetParentId) ?? []
    const plan = planDuplicateOperations({
      items,
      targetParentId,
      targetItems,
      getChildren: (parentId) => parentItemsMap.get(parentId) ?? [],
    })
    if (plan.status === 'needs-decision') {
      handleDuplicatePlanNeedingDecision(items, targetParentId, targetItems, plan.conflicts)
      return
    }
    if (plan.status === 'cancelled') return

    try {
      const createdIds = await runDuplicateIntent(items, targetParentId, plan.operations)
      toast.success(createdIds.length === 1 ? 'Item copied' : `${createdIds.length} items copied`)
    } catch (error) {
      handleError(error, 'Failed to copy items')
    }
  }

  const resolveDuplicateConflicts = async (
    decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
  ) => {
    if (!pendingDuplicateRequest) return
    const request = pendingDuplicateRequest
    setPendingDuplicateRequest(null)
    const plan = planDuplicateOperations({
      items: request.items,
      targetParentId: request.targetParentId,
      targetItems: request.targetItems,
      decisions,
      getChildren: (parentId) => parentItemsMap.get(parentId) ?? [],
    })
    if (plan.status === 'needs-decision') {
      handleDuplicatePlanNeedingDecision(
        request.items,
        request.targetParentId,
        request.targetItems,
        plan.conflicts,
      )
      return
    }
    if (plan.status !== 'ready') return
    try {
      const createdIds = await runDuplicateIntent(
        request.items,
        request.targetParentId,
        plan.operations,
        decisions,
      )
      toast.success(createdIds.length === 1 ? 'Item copied' : `${createdIds.length} items copied`)
    } catch (error) {
      handleError(error, 'Failed to copy items')
    }
  }

  const moveItems = async (
    items: Array<AnySidebarItem>,
    targetParentId = getPasteTargetParentId(activeItemSurface),
    action: MoveIntentAction = 'move',
  ) => {
    items = normalizeItems(items)
    if (!campaignId || items.length === 0) return []
    targetParentId =
      action === 'restore'
        ? getRestoreTargetParentId(activeItemSurface, allItemsMap, targetParentId)
        : targetParentId
    const targetItems = parentItemsMap.get(targetParentId) ?? []
    const plan = planMoveOperations({
      items,
      targetParentId,
      targetItems,
      getChildren: (parentId) => parentItemsMap.get(parentId) ?? [],
    })
    if (plan.status === 'needs-decision') {
      handleMovePlanNeedingDecision(items, targetParentId, targetItems, plan.conflicts)
      return []
    }
    if (plan.status === 'cancelled') return []

    try {
      return await runMoveIntent(items, targetParentId, plan.operations, action)
    } catch (error) {
      handleError(error, action === 'restore' ? 'Failed to restore items' : 'Failed to move items')
      return []
    }
  }

  const restoreItems = async (
    items: Array<AnySidebarItem>,
    targetParentId = getPasteTargetParentId(activeItemSurface),
  ) => await moveItems(items, targetParentId, 'restore')

  const trashItems = async (items: Array<AnySidebarItem>) => {
    items = normalizeItems(items)
    if (!campaignId || items.length === 0) return []
    const snapshot = applyOptimisticTrashItems(items)
    try {
      const movedIds = await moveSidebarItemsMutation.mutateAsync({
        sourceItemIds: items.map((item) => item._id),
        targetParentId: null,
        action: 'trash',
      })
      if (movedIds.length > 0) {
        const currentSlug = getSelectedSlug()
        if (items.some((item) => item.slug === currentSlug)) {
          await clearEditorContent()
        }
        toast.success(
          movedIds.length === 1 ? 'Moved to trash' : `Moved ${movedIds.length} items to trash`,
        )
      }
      return movedIds
    } catch (error) {
      applyCacheSnapshot(snapshot)
      handleError(error, 'Failed to move items to trash')
      return []
    }
  }

  const permanentlyDeleteItems = async (items: Array<AnySidebarItem>) => {
    items = normalizeItems(items)
    if (!campaignId || items.length === 0) return []
    const snapshot = applyOptimisticPermanentDeleteItems(items)
    try {
      const deletedIds = await permanentlyDeleteSidebarItemsMutation.mutateAsync({
        sourceItemIds: items.map((item) => item._id),
      })
      if (deletedIds.length > 0) {
        toast.success(
          deletedIds.length === 1
            ? 'Item permanently deleted'
            : `${deletedIds.length} items permanently deleted`,
        )
        const currentSlug = getSelectedSlug()
        if (items.some((item) => item.slug === currentSlug)) {
          await clearEditorContent()
        }
      }
      return deletedIds
    } catch (error) {
      applyCacheSnapshot(snapshot)
      handleError(error, items.length === 1 ? 'Failed to delete item' : 'Failed to delete items')
      return []
    }
  }

  const resolveMoveConflicts = async (
    decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
  ) => {
    if (!pendingMoveRequest) return
    const request = pendingMoveRequest
    setPendingMoveRequest(null)
    const plan = planMoveOperations({
      items: request.items,
      targetParentId: request.targetParentId,
      targetItems: request.targetItems,
      decisions,
      getChildren: (parentId) => parentItemsMap.get(parentId) ?? [],
    })
    if (plan.status === 'needs-decision') {
      handleMovePlanNeedingDecision(
        request.items,
        request.targetParentId,
        request.targetItems,
        plan.conflicts,
      )
      return
    }
    if (plan.status !== 'ready') return
    try {
      const movedIds = await runMoveIntent(
        request.items,
        request.targetParentId,
        plan.operations,
        'move',
        decisions,
      )
      toast.success(movedIds.length === 1 ? 'Item moved' : `${movedIds.length} items moved`)
      setItemClipboard(null)
    } catch (error) {
      handleError(error, 'Failed to move items')
    }
  }

  const copyItems = (items: Array<AnySidebarItem>) => {
    items = normalizeItems(items)
    if (!campaignId || items.length === 0) return
    setItemClipboard({
      mode: 'copy',
      campaignId,
      itemIds: items.map((item) => item._id),
    })
  }

  const cutItems = (items: Array<AnySidebarItem>) => {
    items = normalizeItems(items)
    if (!campaignId || items.length === 0) return
    setItemClipboard({
      mode: 'cut',
      campaignId,
      itemIds: items.map((item) => item._id),
    })
  }

  const pasteClipboard = async (targetParentId = getPasteTargetParentId(activeItemSurface)) => {
    if (!campaignId || !itemClipboard || itemClipboard.campaignId !== campaignId) return
    let items = resolveItemsById(itemClipboard.itemIds)
    items = normalizeItems(items)
    if (items.length === 0) return

    if (itemClipboard.mode === 'copy') {
      await duplicateItems(items, targetParentId)
      return
    }

    try {
      const movedIds = await moveItems(items, targetParentId)
      if (movedIds.length === 0) return
      setItemClipboard(null)
      toast.success(movedIds.length === 1 ? 'Item moved' : `${movedIds.length} items moved`)
    } catch (error) {
      handleError(error, 'Failed to move items')
    }
  }

  const confirmPermanentDeleteItems = (items: Array<AnySidebarItem>) => {
    items = normalizeItems(items)
    if (items.length === 0) return
    setPendingPermanentDeleteItems(items)
  }

  const closePermanentDeleteDialog = () => setPendingPermanentDeleteItems(null)

  const confirmPermanentDelete = async (items: Array<AnySidebarItem>) => {
    await permanentlyDeleteItems(items)
    closePermanentDeleteDialog()
  }

  const dialog = pendingDuplicateRequest ? (
    <ItemOperationConflictDialog
      key={`duplicate-${pendingDuplicateRequest.conflicts.map((conflict) => conflict.sourceItemId).join(':')}`}
      conflicts={pendingDuplicateRequest.conflicts}
      onResolve={(decisions) => {
        void resolveDuplicateConflicts(decisions)
      }}
      onCancel={() => setPendingDuplicateRequest(null)}
    />
  ) : pendingMoveRequest ? (
    <ItemOperationConflictDialog
      key={`move-${pendingMoveRequest.conflicts.map((conflict) => conflict.sourceItemId).join(':')}`}
      conflicts={pendingMoveRequest.conflicts}
      onResolve={(decisions) => {
        void resolveMoveConflicts(decisions)
      }}
      onCancel={() => setPendingMoveRequest(null)}
    />
  ) : pendingPermanentDeleteItems && pendingPermanentDeleteItems.length === 1 ? (
    <PermanentDeleteConfirmDialog
      item={pendingPermanentDeleteItems[0]}
      onClose={closePermanentDeleteDialog}
      onConfirm={() => confirmPermanentDelete(pendingPermanentDeleteItems)}
    />
  ) : pendingPermanentDeleteItems && pendingPermanentDeleteItems.length > 1 ? (
    <ConfirmationDialog
      isOpen={true}
      onClose={closePermanentDeleteDialog}
      onConfirm={() => confirmPermanentDelete(pendingPermanentDeleteItems)}
      title="Permanently Delete Items"
      description={`This will permanently delete ${pendingPermanentDeleteItems.length} selected items and cannot be undone.`}
      confirmLabel="Delete Forever"
      confirmVariant="destructive"
    />
  ) : null

  return {
    selectedItems,
    copyItems,
    cutItems,
    pasteClipboard,
    duplicateItems,
    moveItems,
    restoreItems,
    trashItems,
    permanentlyDeleteItems,
    confirmPermanentDeleteItems,
    normalizeItems,
    dialog,
  }
}

export function useSidebarItemOperations() {
  const value = use(SidebarItemOperationsContext)
  if (!value) {
    throw new Error('useSidebarItemOperations must be used inside SidebarItemOperationsProvider')
  }
  return value
}
