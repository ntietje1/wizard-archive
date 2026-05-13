import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'convex/sidebarItems/filesystem/receipts'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { FileSystemReadModel } from 'convex/sidebarItems/filesystem/readModel'
import { parseSidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import {
  getReceiptNavigationSlug,
  getReceiptRemovedRootIds,
  getReceiptSelectedRootIds,
} from './filesystem-receipt-selectors'
import { logger } from '~/shared/utils/logger'

function isItemOrDescendantOfRoot(
  item: AnySidebarItem,
  rootIds: ReadonlySet<Id<'sidebarItems'>>,
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
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
  rootItems: Array<AnySidebarItem>
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
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
}: {
  deletedItems: Array<AnySidebarItem>
  currentSlug: SidebarItemSlug | null
  getItemBySlug: (slug: SidebarItemSlug) => AnySidebarItem | undefined
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
}) {
  if (!currentSlug) return false
  const currentItem = getItemBySlug(currentSlug)
  if (!currentItem) return false
  const deletedIds = new Set(deletedItems.map((item) => item._id))
  return isItemOrDescendantOfRoot(currentItem, deletedIds, allItemsMap)
}

export async function applyFileSystemReceiptEffects({
  receipt,
  readModel,
  currentSlug,
  getSelectedItemIds,
  setSelectedItemIds,
  clearEditorContent,
  navigateToItem,
}: {
  receipt: FileSystemTransactionReceipt
  readModel: FileSystemReadModel<AnySidebarItem>
  currentSlug: string | null
  getSelectedItemIds: () => Array<Id<'sidebarItems'>>
  setSelectedItemIds: (itemIds: Array<Id<'sidebarItems'>>) => void
  clearEditorContent: () => Promise<void>
  navigateToItem: (slug: SidebarItemSlug, replace?: boolean) => Promise<void>
}) {
  const selectedRootIds = getReceiptSelectedRootIds(receipt)
  if (selectedRootIds.length > 0) {
    setSelectedItemIds(selectedRootIds)
  }

  const currentSidebarSlug = currentSlug ? parseSidebarItemSlug(currentSlug) : null
  const removedRootItemIds = getReceiptRemovedRootIds(receipt)
  if (removedRootItemIds.length > 0) {
    const currentSelectedItemIds = getSelectedItemIds()
    const removedItems = readModel.getItems(removedRootItemIds)
    const remainingSelection = removeItemsUnderRootsFromSelection({
      selectedItemIds: currentSelectedItemIds,
      rootItems: removedItems,
      allItemsMap: readModel.itemsById,
    })
    if (remainingSelection.length !== currentSelectedItemIds.length) {
      setSelectedItemIds(remainingSelection)
    }
    if (
      shouldClearEditorForDeletedRoots({
        deletedItems: removedItems,
        currentSlug: currentSidebarSlug,
        getItemBySlug: readModel.getItemBySlug,
        allItemsMap: readModel.itemsById,
      })
    ) {
      try {
        await clearEditorContent()
      } catch (error) {
        logger.error('Failed to clear editor content after filesystem receipt', error)
      }
    }
  }

  const navigationSlug = getReceiptNavigationSlug(receipt, currentSlug)
  const parsedNavigationSlug = navigationSlug ? parseSidebarItemSlug(navigationSlug) : null
  if (parsedNavigationSlug) {
    try {
      await navigateToItem(parsedNavigationSlug, true)
    } catch (error) {
      logger.error('Failed to navigate after filesystem receipt', {
        slug: parsedNavigationSlug,
        error,
      })
    }
  }
}
