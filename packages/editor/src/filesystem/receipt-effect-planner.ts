import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceTransactionReceipt } from './transaction-contract'
import type { FileSystemLifecycleIntent } from './domain/lifecycle'
import type { AnyItem, WorkspaceResourceReadModel } from '../workspace/items'
import {
  getReceiptRemovedItemSnapshots,
  getReceiptNavigationItemId,
  getReceiptRemovedRootIds,
  getReceiptSelectedRootIds,
} from './receipt-selectors'
import type { ReceiptRemovedItemSnapshot } from './receipt-selectors'

type ReceiptEffectItem = Pick<AnyItem, 'id' | 'parentId' | 'slug'>

function isItemOrDescendantOfRoot(
  item: ReceiptEffectItem,
  rootIds: ReadonlySet<SidebarItemId>,
  allItemsMap: ReadonlyMap<SidebarItemId, ReceiptEffectItem>,
) {
  if (rootIds.has(item.id)) return true
  let parentId = item.parentId
  const seen = new Set<SidebarItemId>([item.id])
  while (parentId && !seen.has(parentId)) {
    if (rootIds.has(parentId)) return true
    seen.add(parentId)
    parentId = allItemsMap.get(parentId)?.parentId ?? null
  }
  return false
}

function removeItemsUnderRootsFromSelection({
  selectedItemIds,
  rootItems,
  allItemsMap,
}: {
  selectedItemIds: ReadonlyArray<SidebarItemId>
  rootItems: Array<ReceiptEffectItem>
  allItemsMap: ReadonlyMap<SidebarItemId, ReceiptEffectItem>
}) {
  const rootIds = new Set(rootItems.map((item) => item.id))
  return selectedItemIds.filter((selectedId) => {
    const selectedItem = allItemsMap.get(selectedId)
    return selectedItem ? !isItemOrDescendantOfRoot(selectedItem, rootIds, allItemsMap) : false
  })
}

function shouldClearEditorForDeletedRoots({
  deletedItems,
  currentResourceId,
  allItemsMap,
}: {
  deletedItems: Array<ReceiptEffectItem>
  currentResourceId: SidebarItemId | null
  allItemsMap: ReadonlyMap<SidebarItemId, ReceiptEffectItem>
}) {
  if (!currentResourceId) return false
  const currentItem = allItemsMap.get(currentResourceId)
  if (!currentItem) return false
  const deletedIds = new Set(deletedItems.map((item) => item.id))
  return isItemOrDescendantOfRoot(currentItem, deletedIds, allItemsMap)
}

function mergeRemovedItems({
  rootIds,
  readModel,
  removedSnapshots,
}: {
  rootIds: Array<SidebarItemId>
  readModel: WorkspaceResourceReadModel<AnyItem>
  removedSnapshots: Array<ReceiptRemovedItemSnapshot>
}): {
  rootItems: Array<ReceiptEffectItem>
  allItemsMap: ReadonlyMap<SidebarItemId, ReceiptEffectItem>
} {
  const allItemsMap = new Map<SidebarItemId, ReceiptEffectItem>(readModel.itemsById)
  for (const snapshot of removedSnapshots) {
    allItemsMap.set(snapshot.id, snapshot)
  }

  const snapshotById = new Map(removedSnapshots.map((item) => [item.id, item] as const))
  const rootItems = rootIds.flatMap((itemId) => {
    const item = readModel.itemsById.get(itemId) ?? snapshotById.get(itemId)
    return item ? [item] : []
  })
  return { rootItems, allItemsMap }
}

export function planFileSystemReceiptEffects({
  receipt,
  readModel,
  currentResourceId,
  selectedItemIds,
}: {
  receipt: ResourceTransactionReceipt
  readModel: WorkspaceResourceReadModel<AnyItem>
  currentResourceId: SidebarItemId | null
  selectedItemIds: ReadonlyArray<SidebarItemId>
}): Array<FileSystemLifecycleIntent> {
  const intents: Array<FileSystemLifecycleIntent> = []
  const selectedRootIds = getReceiptSelectedRootIds(receipt)
  let plannedSelection: ReadonlyArray<SidebarItemId> =
    selectedRootIds.length > 0 ? selectedRootIds : selectedItemIds
  let selectionChanged = selectedRootIds.length > 0

  const removedRootItemIds = getReceiptRemovedRootIds(receipt)
  if (removedRootItemIds.length > 0) {
    const { rootItems: removedItems, allItemsMap } = mergeRemovedItems({
      rootIds: removedRootItemIds,
      readModel,
      removedSnapshots: getReceiptRemovedItemSnapshots(receipt),
    })
    const remainingSelection = removeItemsUnderRootsFromSelection({
      selectedItemIds: plannedSelection,
      rootItems: removedItems,
      allItemsMap,
    })
    if (remainingSelection.length !== plannedSelection.length) {
      plannedSelection = remainingSelection
      selectionChanged = true
    }
    if (
      shouldClearEditorForDeletedRoots({
        deletedItems: removedItems,
        currentResourceId,
        allItemsMap,
      })
    ) {
      intents.push({ type: 'clearEditor' })
    }
  }

  if (selectionChanged) {
    intents.push({ type: 'selectItems', itemIds: [...plannedSelection] })
  }

  const navigationItemId = getReceiptNavigationItemId(receipt, currentResourceId)
  if (navigationItemId && readModel.getItem(navigationItemId)) {
    intents.push({ type: 'openResource', itemId: navigationItemId, replace: true })
  }

  return intents
}
