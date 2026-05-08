import { createContext, use, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { ItemOperationConflictDialog } from './item-operation-conflict-dialog'
import { planDuplicateOperations, planMoveOperations } from './item-operation-planner'
import type {
  ConflictDecision,
  DuplicateOperation,
  ItemOperationConflict,
  MoveOperation,
} from './item-operation-planner'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { PermanentDeleteConfirmDialog } from '~/features/context-menu/hooks/trash-utils'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarItemsCache } from '~/features/sidebar/hooks/useSidebarItemsCache'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useDeleteSidebarItem } from '~/features/sidebar/hooks/useDeleteSidebarItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { getSelectedSlug } from '~/features/sidebar/hooks/useSelectedItem'
import { normalizeTopLevelSelectedItems } from '~/features/sidebar/utils/item-selection-normalization'
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

type OperationDecision = {
  sourceItemId: Id<'sidebarItems'>
  action: ConflictDecision['action']
}

type CacheSnapshot = {
  sidebar: Array<AnySidebarItem>
  trash: Array<AnySidebarItem>
}

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
  confirmPermanentDeleteItems: (items: Array<AnySidebarItem>) => void
  normalizeItems: (items: Array<AnySidebarItem>) => Array<AnySidebarItem>
}

export const SidebarItemOperationsContext = createContext<SidebarItemOperationsValue | null>(null)

export function useSidebarItemOperationsValue() {
  const { campaignId } = useCampaign()
  const { parentItemsMap, itemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.sidebar)
  const { itemsMap: trashedItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
  const { permanentlyDeleteItem } = useDeleteSidebarItem()
  const { clearEditorContent } = useEditorNavigation()
  const moveSidebarItemsMutation = useCampaignMutation(api.sidebarItems.mutations.moveSidebarItems)
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

  const allItemsMap = useMemo(
    () => new Map<Id<'sidebarItems'>, AnySidebarItem>([...itemsMap, ...trashedItemsMap]),
    [itemsMap, trashedItemsMap],
  )

  const normalizeItems = useCallback(
    (items: Array<AnySidebarItem>) => normalizeTopLevelSelectedItems(items, allItemsMap),
    [allItemsMap],
  )

  const resolveItemsById = useCallback(
    (ids: Array<Id<'sidebarItems'>>) => {
      const resolvedItems: Array<AnySidebarItem> = []
      for (const id of ids) {
        const item = allItemsMap.get(id)
        if (item) {
          resolvedItems.push(item)
        }
      }
      return resolvedItems
    },
    [allItemsMap],
  )

  const selectedItems = useMemo(() => {
    const resolvedItems = resolveItemsById(selectedItemIds)
    return normalizeTopLevelSelectedItems(resolvedItems, allItemsMap)
  }, [allItemsMap, resolveItemsById, selectedItemIds])

  const getPasteTargetParentId = (fallbackParentId?: Id<'sidebarItems'> | null) =>
    fallbackParentId ?? activeItemSurface?.parentId ?? null

  const restoreCacheSnapshot = (snapshot: CacheSnapshot) => {
    cache.update(SIDEBAR_ITEM_LOCATION.sidebar, () => snapshot.sidebar)
    cache.update(SIDEBAR_ITEM_LOCATION.trash, () => snapshot.trash)
  }

  const getSnapshot = (): CacheSnapshot => ({
    sidebar: cache.get(SIDEBAR_ITEM_LOCATION.sidebar),
    trash: cache.get(SIDEBAR_ITEM_LOCATION.trash),
  })

  const getDescendantIds = (folderId: Id<'sidebarItems'>, items: Array<AnySidebarItem>) => {
    const descendants = new Set<Id<'sidebarItems'>>()
    const visit = (parentId: Id<'sidebarItems'>) => {
      for (const child of items) {
        if (child.parentId !== parentId) continue
        descendants.add(child._id)
        if (child.type === SIDEBAR_ITEM_TYPES.folders) {
          visit(child._id)
        }
      }
    }
    visit(folderId)
    return descendants
  }

  const trashItemTreeInSnapshot = (
    itemId: Id<'sidebarItems'>,
    sidebar: Array<AnySidebarItem>,
    trash: Array<AnySidebarItem>,
    now: number,
  ) => {
    const item = sidebar.find((candidate) => candidate._id === itemId)
    if (!item) return { sidebar, trash }
    const descendantIds =
      item.type === SIDEBAR_ITEM_TYPES.folders ? getDescendantIds(item._id, sidebar) : new Set()
    const movedItems = sidebar.filter(
      (candidate) => candidate._id === item._id || descendantIds.has(candidate._id),
    )
    return {
      sidebar: sidebar.filter(
        (candidate) => candidate._id !== item._id && !descendantIds.has(candidate._id),
      ),
      trash: [
        ...movedItems.map((candidate) => ({
          ...candidate,
          parentId: candidate._id === item._id ? null : candidate.parentId,
          location: SIDEBAR_ITEM_LOCATION.trash,
          deletionTime: now,
        })),
        ...trash,
      ] as Array<AnySidebarItem>,
    }
  }

  const applyOptimisticMoveOperations = (operations: Array<MoveOperation>): CacheSnapshot => {
    const snapshot = getSnapshot()
    let sidebar = [...snapshot.sidebar]
    let trash = [...snapshot.trash]
    const now = Date.now()

    const trashItemTree = (itemId: Id<'sidebarItems'>) => {
      const next = trashItemTreeInSnapshot(itemId, sidebar, trash, now)
      sidebar = next.sidebar
      trash = next.trash
    }

    for (const operation of operations) {
      if (operation.action === 'skip') continue
      if (operation.action === 'replace' && operation.destinationItemId) {
        trashItemTree(operation.destinationItemId)
      }
      if (operation.action === 'mergeFolder') {
        const hasChildren = sidebar.some(
          (candidate) => candidate.parentId === operation.sourceItemId,
        )
        if (!hasChildren) {
          trashItemTree(operation.sourceItemId)
        }
        continue
      }

      const sourceInSidebar = new Map(sidebar.map((item) => [item._id, item])).get(
        operation.sourceItemId,
      )
      const sourceInTrash = new Map(trash.map((item) => [item._id, item])).get(
        operation.sourceItemId,
      )
      const source = sourceInSidebar ?? sourceInTrash
      if (!source) continue

      if (sourceInTrash) {
        const descendantIds =
          source.type === SIDEBAR_ITEM_TYPES.folders
            ? getDescendantIds(source._id, trash)
            : new Set()
        const restoredItems = trash.filter(
          (candidate) => candidate._id === source._id || descendantIds.has(candidate._id),
        )
        trash = trash.filter(
          (candidate) => candidate._id !== source._id && !descendantIds.has(candidate._id),
        )
        sidebar = [
          ...sidebar,
          ...restoredItems.map((candidate) => ({
            ...candidate,
            parentId: candidate._id === source._id ? operation.targetParentId : candidate.parentId,
            location: SIDEBAR_ITEM_LOCATION.sidebar,
            deletionTime: null,
            deletedBy: null,
          })),
        ] as Array<AnySidebarItem>
        continue
      }

      sidebar = sidebar.map((candidate) =>
        candidate._id === source._id
          ? ({
              ...candidate,
              parentId: operation.targetParentId,
              ...(operation.name ? { name: operation.name } : {}),
            } as AnySidebarItem)
          : candidate,
      )
    }

    cache.update(SIDEBAR_ITEM_LOCATION.sidebar, () => sidebar)
    cache.update(SIDEBAR_ITEM_LOCATION.trash, () => trash)
    return snapshot
  }

  const applyOptimisticDuplicateOperations = (
    operations: Array<DuplicateOperation>,
  ): CacheSnapshot => {
    const snapshot = getSnapshot()
    let sidebar = [...snapshot.sidebar]
    let trash = [...snapshot.trash]
    const now = Date.now()
    let tempIndex = 0

    const trashDestination = (itemId: Id<'sidebarItems'>) => {
      const next = trashItemTreeInSnapshot(itemId, sidebar, trash, now)
      sidebar = next.sidebar
      trash = next.trash
    }

    const cloneTree = (
      source: AnySidebarItem,
      parentId: Id<'sidebarItems'> | null,
      name: string,
    ) => {
      const tempId = `optimistic-${source._id}-${now}-${tempIndex++}` as Id<'sidebarItems'>
      const clone = {
        ...source,
        _id: tempId,
        name,
        slug: `${source.slug}-optimistic-${tempIndex}` as AnySidebarItem['slug'],
        parentId,
        location: SIDEBAR_ITEM_LOCATION.sidebar,
        deletionTime: null,
        deletedBy: null,
      } as AnySidebarItem
      sidebar.push(clone)
      if (source.type !== SIDEBAR_ITEM_TYPES.folders) return tempId
      for (const child of snapshot.sidebar.filter(
        (candidate) => candidate.parentId === source._id,
      )) {
        cloneTree(child, tempId, child.name)
      }
      return tempId
    }

    const snapshotSidebarMap = new Map(snapshot.sidebar.map((item) => [item._id, item]))
    for (const operation of operations) {
      if (operation.action === 'skip') continue
      if (operation.action === 'replace' && operation.destinationItemId) {
        trashDestination(operation.destinationItemId)
      }
      if (operation.action === 'mergeFolder') continue
      const source = snapshotSidebarMap.get(operation.sourceItemId)
      if (!source) continue
      cloneTree(source, operation.targetParentId ?? null, operation.name ?? source.name)
    }

    cache.update(SIDEBAR_ITEM_LOCATION.sidebar, () => sidebar)
    cache.update(SIDEBAR_ITEM_LOCATION.trash, () => trash)
    return snapshot
  }

  const toDecisionArray = (
    decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
  ): Array<OperationDecision> | undefined => {
    if (!decisions) return undefined
    const entries = Object.entries(decisions) as Array<[Id<'sidebarItems'>, ConflictDecision]>
    return entries.map(([sourceItemId, decision]) => ({
      sourceItemId,
      action: decision.action,
    }))
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
      restoreCacheSnapshot(snapshot)
      throw error
    }
  }

  const runMoveIntent = async (
    items: Array<AnySidebarItem>,
    targetParentId: Id<'sidebarItems'> | null,
    operations: Array<MoveOperation>,
    decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
  ) => {
    if (!campaignId || items.length === 0) return []
    const snapshot = applyOptimisticMoveOperations(operations)
    try {
      const movedIds = await moveSidebarItemsMutation.mutateAsync({
        sourceItemIds: items.map((item) => item._id),
        targetParentId,
        decisions: toDecisionArray(decisions),
      })
      if (movedIds.length > 0) {
        setSelectedItemIds(movedIds)
      }
      return movedIds
    } catch (error) {
      restoreCacheSnapshot(snapshot)
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
    targetParentId = getPasteTargetParentId(),
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
    targetParentId = getPasteTargetParentId(),
  ) => {
    items = normalizeItems(items)
    if (!campaignId || items.length === 0) return []
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
      return await runMoveIntent(items, targetParentId, plan.operations)
    } catch (error) {
      handleError(error, 'Failed to move items')
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

  const pasteClipboard = async (targetParentId = getPasteTargetParentId()) => {
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
    const results = await Promise.allSettled(items.map((item) => permanentlyDeleteItem(item)))
    const deletedItems = items.filter((_, index) => results[index]?.status === 'fulfilled')
    const failures = results.filter((result) => result.status === 'rejected')
    try {
      if (deletedItems.length > 0) {
        toast.success(
          deletedItems.length === 1
            ? 'Item permanently deleted'
            : `${deletedItems.length} items permanently deleted`,
        )
      }
      if (failures.length > 0) {
        handleError(
          new Error(`${failures.length} of ${items.length} permanent deletes failed`),
          items.length === 1 ? 'Failed to delete item' : 'Failed to delete items',
        )
      }
      const currentSlug = getSelectedSlug()
      if (deletedItems.some((item) => item.slug === currentSlug)) {
        await clearEditorContent()
      }
    } catch (error) {
      handleError(error, items.length === 1 ? 'Failed to delete item' : 'Failed to delete items')
    }
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
