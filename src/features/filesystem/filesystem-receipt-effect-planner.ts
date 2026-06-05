import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import type { FileSystemLifecycleIntent } from 'shared/sidebar-items/filesystem/lifecycle'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { FileSystemReadModel } from 'shared/sidebar-items/filesystem/read-model'
import { parseSidebarItemSlug } from 'shared/sidebar-items/slug'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import {
  getReceiptRemovedItemSnapshots,
  getReceiptNavigationSlug,
  getReceiptRemovedRootIds,
  getReceiptSelectedRootIds,
} from './filesystem-receipt-selectors'
import type { ReceiptRemovedItemSnapshot } from './filesystem-receipt-selectors'

type ReceiptEffectItem = Pick<AnySidebarItem, '_id' | 'parentId' | 'slug'>

function isItemOrDescendantOfRoot(
  item: ReceiptEffectItem,
  rootIds: ReadonlySet<Id<'sidebarItems'>>,
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, ReceiptEffectItem>,
) {
  if (rootIds.has(item._id)) return true
  let parentId = item.parentId
  const seen = new Set<Id<'sidebarItems'>>([item._id])
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
  selectedItemIds: Array<Id<'sidebarItems'>>
  rootItems: Array<ReceiptEffectItem>
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, ReceiptEffectItem>
}) {
  const rootIds = new Set(rootItems.map((item) => item._id))
  return selectedItemIds.filter((selectedId) => {
    const selectedItem = allItemsMap.get(selectedId)
    return selectedItem ? !isItemOrDescendantOfRoot(selectedItem, rootIds, allItemsMap) : false
  })
}

function shouldClearEditorForDeletedRoots({
  deletedItems,
  currentSlug,
  getItemBySlug,
  allItemsMap,
  allItemsBySlug,
}: {
  deletedItems: Array<ReceiptEffectItem>
  currentSlug: SidebarItemSlug | null
  getItemBySlug: (slug: SidebarItemSlug) => ReceiptEffectItem | undefined
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, ReceiptEffectItem>
  allItemsBySlug: ReadonlyMap<SidebarItemSlug, ReceiptEffectItem>
}) {
  if (!currentSlug) return false
  const currentItem = getItemBySlug(currentSlug) ?? allItemsBySlug.get(currentSlug) ?? undefined
  if (!currentItem) return false
  const deletedIds = new Set(deletedItems.map((item) => item._id))
  return isItemOrDescendantOfRoot(currentItem, deletedIds, allItemsMap)
}

function mergeRemovedItems({
  rootIds,
  readModel,
  removedSnapshots,
}: {
  rootIds: Array<Id<'sidebarItems'>>
  readModel: FileSystemReadModel<AnySidebarItem>
  removedSnapshots: Array<ReceiptRemovedItemSnapshot>
}): {
  rootItems: Array<ReceiptEffectItem>
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, ReceiptEffectItem>
  allItemsBySlug: ReadonlyMap<SidebarItemSlug, ReceiptEffectItem>
} {
  const allItemsMap = new Map<Id<'sidebarItems'>, ReceiptEffectItem>(readModel.itemsById)
  for (const snapshot of removedSnapshots) {
    allItemsMap.set(snapshot._id, snapshot)
  }

  const snapshotById = new Map(removedSnapshots.map((item) => [item._id, item] as const))
  const allItemsBySlug = new Map<SidebarItemSlug, ReceiptEffectItem>(
    Array.from(allItemsMap.values(), (item) => [item.slug, item] as const),
  )
  const rootItems = rootIds.flatMap((itemId) => {
    const item = readModel.itemsById.get(itemId) ?? snapshotById.get(itemId)
    return item ? [item] : []
  })
  return { rootItems, allItemsMap, allItemsBySlug }
}

export function planFileSystemReceiptEffects({
  receipt,
  readModel,
  currentSlug,
  selectedItemIds,
}: {
  receipt: FileSystemTransactionReceipt
  readModel: FileSystemReadModel<AnySidebarItem>
  currentSlug: string | null
  selectedItemIds: Array<Id<'sidebarItems'>>
}): Array<FileSystemLifecycleIntent> {
  const intents: Array<FileSystemLifecycleIntent> = []
  const selectedRootIds = getReceiptSelectedRootIds(receipt)
  if (selectedRootIds.length > 0) {
    intents.push({ type: 'selectItems', itemIds: selectedRootIds })
  }

  const currentSidebarSlug = currentSlug ? parseSidebarItemSlug(currentSlug) : null
  const removedRootItemIds = getReceiptRemovedRootIds(receipt)
  if (removedRootItemIds.length > 0) {
    const {
      rootItems: removedItems,
      allItemsMap,
      allItemsBySlug,
    } = mergeRemovedItems({
      rootIds: removedRootItemIds,
      readModel,
      removedSnapshots: getReceiptRemovedItemSnapshots(receipt),
    })
    const remainingSelection = removeItemsUnderRootsFromSelection({
      selectedItemIds,
      rootItems: removedItems,
      allItemsMap,
    })
    if (remainingSelection.length !== selectedItemIds.length) {
      intents.push({ type: 'selectItems', itemIds: remainingSelection })
    }
    if (
      shouldClearEditorForDeletedRoots({
        deletedItems: removedItems,
        currentSlug: currentSidebarSlug,
        getItemBySlug: readModel.getItemBySlug,
        allItemsMap,
        allItemsBySlug,
      })
    ) {
      intents.push({ type: 'clearEditor' })
    }
  }

  const navigationSlug = getReceiptNavigationSlug(receipt, currentSlug)
  const parsedNavigationSlug = navigationSlug ? parseSidebarItemSlug(navigationSlug) : null
  if (parsedNavigationSlug) {
    intents.push({ type: 'navigateToItem', slug: parsedNavigationSlug, replace: true })
  }

  return intents
}
