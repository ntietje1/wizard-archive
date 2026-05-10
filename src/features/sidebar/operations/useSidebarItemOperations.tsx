import { createContext, use, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { DuplicateSidebarItemsResult } from 'convex/sidebarItems/functions/duplicateSidebarItems'
import type { MoveSidebarItemsResult } from 'convex/sidebarItems/functions/moveSidebarItems'
import type { PermanentlyDeleteSidebarItemsResult } from 'convex/sidebarItems/functions/permanentlyDeleteSidebarItems'
import { planDuplicateOperations } from 'convex/sidebarItems/operations/duplicatePlanner'
import { planMoveOperations } from 'convex/sidebarItems/operations/movePlanner'
import { normalizeTopLevelSelectedItems } from 'convex/sidebarItems/operations/selection'
import {
  getPasteTargetParentId,
  getRestoreTargetParentId,
} from 'convex/sidebarItems/operations/operationTargets'
import { ItemOperationConflictDialog } from './item-operation-conflict-dialog'
import { toDecisionArray } from './operation-decisions'
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
import {
  removeItemsUnderRootsFromSelection,
  resolveItemsById,
  shouldClearEditorForDeletedRoots,
} from './delete-selection-helpers'

type PendingDuplicateRequest = {
  kind: 'duplicate'
  items: Array<AnySidebarItem>
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<AnySidebarItem>
  conflicts: Array<ItemOperationConflict>
}

type MoveIntentAction = 'move' | 'restore'
type PendingMoveRequest = Omit<PendingDuplicateRequest, 'kind'> & {
  kind: 'move'
  action: MoveIntentAction
}
type PendingConflictRequest = PendingDuplicateRequest | PendingMoveRequest

export interface SidebarItemOperationsValue {
  selectedItems: Array<AnySidebarItem>
  dialog: ReactNode
  copyItems: (items: Array<AnySidebarItem>) => void
  cutItems: (items: Array<AnySidebarItem>) => void
  pasteClipboard: (targetParentId?: Id<'sidebarItems'> | null) => Promise<void>
  duplicateItems: (
    items: Array<AnySidebarItem>,
    targetParentId?: Id<'sidebarItems'> | null,
  ) => Promise<Array<Id<'sidebarItems'>>>
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
  confirmPermanentDeleteItems: (items: Array<AnySidebarItem>) => boolean
  normalizeItems: (items: Array<AnySidebarItem>) => Array<AnySidebarItem>
}

export const SidebarItemOperationsContext = createContext<SidebarItemOperationsValue | null>(null)

function uniqueIds(ids: Array<Id<'sidebarItems'>>): Array<Id<'sidebarItems'>> {
  return [...new Set(ids)]
}

function sourceIdsInRequest(
  sourceItemIds: Array<Id<'sidebarItems'>>,
  requestedItems: Array<AnySidebarItem>,
): Array<Id<'sidebarItems'>> {
  const requestedItemIds = new Set(requestedItems.map((item) => item._id))
  return uniqueIds(sourceItemIds.filter((sourceItemId) => requestedItemIds.has(sourceItemId)))
}

function pluralizeItems(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural
}

function showDuplicateResultToast(
  result: DuplicateSidebarItemsResult,
  requestedItems: Array<AnySidebarItem>,
) {
  const copiedCount = result.createdRootItemIds.length
  const mergedCount = sourceIdsInRequest(result.mergedSourceItemIds, requestedItems).length

  if (copiedCount === 0 && mergedCount === 0) {
    toast.info('No items copied')
    return
  }

  if (copiedCount > 0 && mergedCount > 0) {
    toast.success(
      `Copied ${copiedCount} ${pluralizeItems(copiedCount, 'item')}, merged ${mergedCount} ${pluralizeItems(mergedCount, 'folder')}`,
    )
    return
  }

  if (mergedCount > 0) {
    toast.success(mergedCount === 1 ? 'Folder merged' : `${mergedCount} folders merged`)
    return
  }

  toast.success(copiedCount === 1 ? 'Item copied' : `${copiedCount} items copied`)
}

function getMoveResultRootIds(
  result: MoveSidebarItemsResult,
  requestedItems: Array<AnySidebarItem>,
  action: MoveIntentAction,
): Array<Id<'sidebarItems'>> {
  const directSourceIds =
    action === 'restore' ? result.restoredSourceItemIds : result.movedSourceItemIds
  return uniqueIds([
    ...sourceIdsInRequest(directSourceIds, requestedItems),
    ...sourceIdsInRequest(result.mergedSourceItemIds, requestedItems),
  ])
}

function showMoveResultToast(
  result: MoveSidebarItemsResult,
  requestedItems: Array<AnySidebarItem>,
  action: MoveIntentAction,
) {
  const directSourceIds = sourceIdsInRequest(
    action === 'restore' ? result.restoredSourceItemIds : result.movedSourceItemIds,
    requestedItems,
  )
  const mergedSourceIds = sourceIdsInRequest(result.mergedSourceItemIds, requestedItems)
  const label = action === 'restore' ? 'restored' : 'moved'
  const labelCapitalized = action === 'restore' ? 'Restored' : 'Moved'

  if (directSourceIds.length === 0 && mergedSourceIds.length === 0) {
    toast.info(`No items ${label}`)
    return
  }

  if (directSourceIds.length > 0 && mergedSourceIds.length > 0) {
    toast.success(
      `${labelCapitalized} ${directSourceIds.length} ${pluralizeItems(directSourceIds.length, 'item')}, merged ${mergedSourceIds.length} ${pluralizeItems(mergedSourceIds.length, 'folder')}`,
    )
    return
  }

  if (mergedSourceIds.length > 0) {
    toast.success(
      mergedSourceIds.length === 1 ? 'Folder merged' : `${mergedSourceIds.length} folders merged`,
    )
    return
  }

  toast.success(
    directSourceIds.length === 1 ? `Item ${label}` : `${directSourceIds.length} items ${label}`,
  )
}

export function useSidebarItemOperationsValue() {
  const { campaignId, campaign } = useCampaign()
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
  const [pendingConflictRequest, setPendingConflictRequest] =
    useState<PendingConflictRequest | null>(null)
  const [pendingPermanentDeleteItems, setPendingPermanentDeleteItems] =
    useState<Array<AnySidebarItem> | null>(null)

  const allItemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([...itemsMap, ...trashedItemsMap])
  const itemBySlug = new Map<SidebarItemSlug, AnySidebarItem>(
    Array.from(allItemsMap.values(), (item) => [item.slug, item] as const),
  )

  const normalizeItems = (items: Array<AnySidebarItem>) =>
    normalizeTopLevelSelectedItems(items, allItemsMap)

  const selectedItems = normalizeTopLevelSelectedItems(
    resolveItemsById(selectedItemIds, allItemsMap),
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
    applyCacheSnapshot(
      applyOptimisticTrashItemsToSnapshot(
        snapshot,
        items,
        Date.now(),
        campaign.data?.myMembership?.userId ?? null,
      ),
    )
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
    if (!campaignId || items.length === 0) {
      return {
        createdItemIds: [],
        createdRootItemIds: [],
        copiedSourceItemIds: [],
        replacedSourceItemIds: [],
        mergedSourceItemIds: [],
        skippedSourceItemIds: [],
      } satisfies DuplicateSidebarItemsResult
    }
    const snapshot = applyOptimisticDuplicateOperations(operations)
    try {
      const result: DuplicateSidebarItemsResult = await duplicateSidebarItemsMutation.mutateAsync({
        sourceItemIds: items.map((item) => item._id),
        targetParentId,
        decisions: toDecisionArray(decisions),
      })
      if (result.createdRootItemIds.length > 0) {
        setSelectedItemIds(result.createdRootItemIds)
      }
      return result
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
    if (!campaignId || items.length === 0) {
      return {
        affectedItemIds: [],
        movedSourceItemIds: [],
        restoredSourceItemIds: [],
        trashedSourceItemIds: [],
        mergedSourceItemIds: [],
        skippedSourceItemIds: [],
        noopSourceItemIds: [],
      } satisfies MoveSidebarItemsResult
    }
    const snapshot = applyOptimisticMoveOperations(operations)
    try {
      const result: MoveSidebarItemsResult = await moveSidebarItemsMutation.mutateAsync({
        sourceItemIds: items.map((item) => item._id),
        targetParentId,
        action,
        decisions: toDecisionArray(decisions),
      })
      return result
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
    setPendingConflictRequest({
      kind: 'duplicate',
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
    action: MoveIntentAction,
  ) => {
    setPendingConflictRequest({
      kind: 'move',
      action,
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
    if (!campaignId || items.length === 0) return []
    const targetItems = parentItemsMap.get(targetParentId) ?? []
    const plan = planDuplicateOperations({
      items,
      targetParentId,
      targetItems,
      getChildren: (parentId) => parentItemsMap.get(parentId) ?? [],
    })
    if (plan.status === 'needs-decision') {
      handleDuplicatePlanNeedingDecision(items, targetParentId, targetItems, plan.conflicts)
      return []
    }
    if (plan.status === 'cancelled') return []

    try {
      const result = await runDuplicateIntent(items, targetParentId, plan.operations)
      showDuplicateResultToast(result, items)
      return result.createdRootItemIds
    } catch (error) {
      handleError(error, 'Failed to copy items')
      return []
    }
  }

  const resolveDuplicateConflicts = async (
    request: PendingDuplicateRequest,
    decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
  ) => {
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
      const result = await runDuplicateIntent(
        request.items,
        request.targetParentId,
        plan.operations,
        decisions,
      )
      showDuplicateResultToast(result, request.items)
    } catch (error) {
      handleError(error, 'Failed to copy items')
    }
  }

  const moveItems = async (
    items: Array<AnySidebarItem>,
    targetParentId = getPasteTargetParentId(activeItemSurface),
    action: MoveIntentAction = 'move',
    showResultToast = false,
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
      handleMovePlanNeedingDecision(items, targetParentId, targetItems, plan.conflicts, action)
      return []
    }
    if (plan.status === 'cancelled') return []

    try {
      const result = await runMoveIntent(items, targetParentId, plan.operations, action)
      if (showResultToast) {
        showMoveResultToast(result, items, action)
      }
      return getMoveResultRootIds(result, items, action)
    } catch (error) {
      handleError(error, action === 'restore' ? 'Failed to restore items' : 'Failed to move items')
      return []
    }
  }

  const restoreItems = async (
    items: Array<AnySidebarItem>,
    targetParentId = getPasteTargetParentId(activeItemSurface),
  ) => await moveItems(items, targetParentId, 'restore', true)

  const trashItems = async (items: Array<AnySidebarItem>) => {
    items = normalizeItems(items)
    if (!campaignId || items.length === 0) return []
    const snapshot = applyOptimisticTrashItems(items)
    try {
      const result: MoveSidebarItemsResult = await moveSidebarItemsMutation.mutateAsync({
        sourceItemIds: items.map((item) => item._id),
        targetParentId: null,
        action: 'trash',
      })
      const trashedIds = sourceIdsInRequest(result.trashedSourceItemIds, items)
      if (trashedIds.length > 0) {
        const trashedItems = items.filter((item) => trashedIds.includes(item._id))
        const remainingSelection = removeItemsUnderRootsFromSelection({
          selectedItemIds,
          rootItems: trashedItems,
          allItemsMap,
        })
        if (remainingSelection.length !== selectedItemIds.length) {
          setSelectedItemIds(remainingSelection)
        }
        if (
          shouldClearEditorForDeletedRoots({
            deletedItems: trashedItems,
            currentSlug: getSelectedSlug(),
            itemBySlug,
            allItemsMap,
          })
        ) {
          await clearEditorContent()
        }
        toast.success(
          trashedIds.length === 1 ? 'Moved to trash' : `Moved ${trashedIds.length} items to trash`,
        )
      }
      return trashedIds
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
      const result: PermanentlyDeleteSidebarItemsResult =
        await permanentlyDeleteSidebarItemsMutation.mutateAsync({
          sourceItemIds: items.map((item) => item._id),
        })
      const deletedIds = sourceIdsInRequest(result.deletedRootItemIds, items)
      if (deletedIds.length > 0) {
        const deletedItems = items.filter((item) => deletedIds.includes(item._id))
        const remainingSelection = removeItemsUnderRootsFromSelection({
          selectedItemIds,
          rootItems: deletedItems,
          allItemsMap,
        })
        if (remainingSelection.length !== selectedItemIds.length) {
          setSelectedItemIds(remainingSelection)
        }
        if (
          shouldClearEditorForDeletedRoots({
            deletedItems,
            currentSlug: getSelectedSlug(),
            itemBySlug,
            allItemsMap,
          })
        ) {
          await clearEditorContent()
        }
        toast.success(
          deletedIds.length === 1
            ? 'Item permanently deleted'
            : `${deletedIds.length} items permanently deleted`,
        )
      }
      return deletedIds
    } catch (error) {
      applyCacheSnapshot(snapshot)
      handleError(error, items.length === 1 ? 'Failed to delete item' : 'Failed to delete items')
      return []
    }
  }

  const resolveMoveConflicts = async (
    request: PendingMoveRequest,
    decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
  ) => {
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
        request.action,
      )
      return
    }
    if (plan.status !== 'ready') return
    try {
      const result = await runMoveIntent(
        request.items,
        request.targetParentId,
        plan.operations,
        request.action,
        decisions,
      )
      showMoveResultToast(result, request.items, request.action)
      if (request.action === 'move') {
        setItemClipboard(null)
      }
    } catch (error) {
      handleError(
        error,
        request.action === 'restore' ? 'Failed to restore items' : 'Failed to move items',
      )
    }
  }

  const resolveConflicts = async (
    decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
  ) => {
    if (!pendingConflictRequest) return
    const request = pendingConflictRequest
    setPendingConflictRequest(null)
    if (request.kind === 'duplicate') {
      await resolveDuplicateConflicts(request, decisions)
      return
    }
    await resolveMoveConflicts(request, decisions)
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
    let items = resolveItemsById(itemClipboard.itemIds, allItemsMap)
    items = normalizeItems(items)
    if (items.length === 0) return

    if (itemClipboard.mode === 'copy') {
      await duplicateItems(items, targetParentId)
      return
    }

    if (items.every((item) => item.parentId === targetParentId)) {
      setItemClipboard(null)
      return
    }

    const movedIds = await moveItems(items, targetParentId)
    if (movedIds.length === 0) return
    setItemClipboard(null)
    toast.success(movedIds.length === 1 ? 'Item moved' : `${movedIds.length} items moved`)
  }

  const confirmPermanentDeleteItems = (items: Array<AnySidebarItem>) => {
    items = normalizeItems(items)
    if (items.length === 0) return false
    setPendingPermanentDeleteItems(items)
    return true
  }

  const closePermanentDeleteDialog = () => setPendingPermanentDeleteItems(null)

  const confirmPermanentDelete = async (items: Array<AnySidebarItem>) => {
    await permanentlyDeleteItems(items)
    closePermanentDeleteDialog()
  }

  const renderDialog = () => {
    if (pendingConflictRequest) {
      return (
        <ItemOperationConflictDialog
          key={`${pendingConflictRequest.kind}-${pendingConflictRequest.conflicts.map((conflict) => `${conflict.sourceItemId}:${conflict.destinationItemId}`).join(':')}`}
          conflicts={pendingConflictRequest.conflicts}
          onResolve={(decisions) => {
            void resolveConflicts(decisions)
          }}
          onCancel={() => setPendingConflictRequest(null)}
        />
      )
    }

    if (!pendingPermanentDeleteItems) return null
    if (pendingPermanentDeleteItems.length === 1) {
      return (
        <PermanentDeleteConfirmDialog
          item={pendingPermanentDeleteItems[0]}
          onClose={closePermanentDeleteDialog}
          onConfirm={() => confirmPermanentDelete(pendingPermanentDeleteItems)}
        />
      )
    }

    return (
      <ConfirmationDialog
        isOpen={true}
        onClose={closePermanentDeleteDialog}
        onConfirm={() => confirmPermanentDelete(pendingPermanentDeleteItems)}
        title="Permanently Delete Items"
        description={`This will permanently delete ${pendingPermanentDeleteItems.length} selected items and cannot be undone.`}
        confirmLabel="Delete Forever"
        confirmVariant="destructive"
      />
    )
  }

  const dialog = renderDialog()

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
