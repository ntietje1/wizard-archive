import { useEffect } from 'react'
import { toast } from 'sonner'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useMoveSidebarItem } from '~/features/sidebar/hooks/useMoveSidebarItem'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import {
  isEditableHotkeyTarget,
  isModifierShortcut,
} from '~/features/sidebar/utils/item-surface-hotkeys'
import { handleError } from '~/shared/utils/logger'

interface ItemSurfaceHotkeyOperations {
  copyItems: (items: Array<AnySidebarItem>) => void
  cutItems: (items: Array<AnySidebarItem>) => void
  pasteClipboard: (targetParentId?: AnySidebarItem['_id'] | null) => Promise<void>
  confirmPermanentDeleteItems: (items: Array<AnySidebarItem>) => void
  normalizeItems: (items: Array<AnySidebarItem>) => Array<AnySidebarItem>
}

function resolveItems(
  ids: Array<AnySidebarItem['_id']>,
  activeItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>,
  trashedItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>,
): Array<AnySidebarItem> {
  return ids
    .map((id) => activeItemsMap.get(id) ?? trashedItemsMap.get(id))
    .filter((item): item is AnySidebarItem => Boolean(item))
}

export function useItemSurfaceHotkeys(itemOperations?: ItemSurfaceHotkeyOperations) {
  const { campaignId } = useCampaign()
  const { itemsMap: activeItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.sidebar)
  const { itemsMap: trashedItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
  const { moveItem } = useMoveSidebarItem()
  const { navigateToItem, clearEditorContent } = useEditorNavigation()
  const { setLastSelectedItem } = useLastEditorItem()
  const { openParentFolders } = useOpenParentFolders()

  const activeItemSurface = useSidebarUIStore((s) => s.activeItemSurface)
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const itemClipboard = useSidebarUIStore((s) => s.itemClipboard)
  const setSelectedItemIds = useSidebarUIStore((s) => s.setSelectedItemIds)
  const clearItemSelection = useSidebarUIStore((s) => s.clearItemSelection)
  const setItemClipboard = useSidebarUIStore((s) => s.setItemClipboard)
  const setRenamingId = useSidebarUIStore((s) => s.setRenamingId)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeItemSurface || isEditableHotkeyTarget(event.target)) return

      const rawSelectedItems = resolveItems(selectedItemIds, activeItemsMap, trashedItemsMap)
      const selectedItems = itemOperations
        ? itemOperations.normalizeItems(rawSelectedItems)
        : rawSelectedItems
      const selectedIds = selectedItems.map((item) => item._id)

      if (isModifierShortcut(event, 'a')) {
        event.preventDefault()
        setSelectedItemIds(activeItemSurface.visibleItemIds)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        clearItemSelection()
        return
      }

      if (isModifierShortcut(event, 'c') || isModifierShortcut(event, 'x')) {
        if (!campaignId || selectedIds.length === 0) return
        event.preventDefault()
        if (itemOperations) {
          if (isModifierShortcut(event, 'x')) {
            itemOperations.cutItems(selectedItems)
          } else {
            itemOperations.copyItems(selectedItems)
          }
          return
        }
        setItemClipboard({
          mode: isModifierShortcut(event, 'x') ? 'cut' : 'copy',
          campaignId,
          itemIds: selectedIds,
        })
        return
      }

      if (isModifierShortcut(event, 'v')) {
        if (!campaignId || !itemClipboard || itemClipboard.campaignId !== campaignId) return
        event.preventDefault()

        if (itemOperations) {
          void itemOperations.pasteClipboard(activeItemSurface.parentId)
          return
        }

        if (itemClipboard.mode === 'copy') {
          toast.info('Copy paste duplication is not available yet')
          return
        }

        void (async () => {
          const items = resolveItems(itemClipboard.itemIds, activeItemsMap, trashedItemsMap)
          const results = await Promise.allSettled(
            items.map((item) => {
              if (item.location === SIDEBAR_ITEM_LOCATION.trash) {
                return moveItem(item, {
                  location: SIDEBAR_ITEM_LOCATION.sidebar,
                  parentId: activeItemSurface.parentId,
                })
              }
              return moveItem(item, { parentId: activeItemSurface.parentId })
            }),
          )
          const movedItems = items.filter((_, index) => results[index]?.status === 'fulfilled')
          const failures = results.filter((result) => result.status === 'rejected')
          if (movedItems.length > 0) {
            setItemClipboard(null)
            setSelectedItemIds(movedItems.map((item) => item._id))
            toast.success(
              movedItems.length === 1 ? 'Item moved' : `${movedItems.length} items moved`,
            )
          }
          if (failures.length > 0) {
            handleError(
              new Error(`${failures.length} of ${items.length} paste moves failed`),
              'Failed to paste all items',
            )
          }
        })()
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedItems.length > 0) {
        event.preventDefault()
        if (activeItemSurface.surface === 'trash') {
          itemOperations?.confirmPermanentDeleteItems(selectedItems)
          return
        }

        void (async () => {
          const activeItems = selectedItems.filter(
            (item) => item.location !== SIDEBAR_ITEM_LOCATION.trash,
          )
          const results = await Promise.allSettled(
            activeItems.map((item) => moveItem(item, { location: SIDEBAR_ITEM_LOCATION.trash })),
          )
          const movedItems = activeItems.filter(
            (_, index) => results[index]?.status === 'fulfilled',
          )
          const failures = results.filter((result) => result.status === 'rejected')
          if (movedItems.length > 0) {
            await clearEditorContent()
            toast.success(
              movedItems.length === 1
                ? 'Moved to trash'
                : `Moved ${movedItems.length} items to trash`,
            )
          }
          if (failures.length > 0) {
            handleError(
              new Error(`${failures.length} of ${activeItems.length} trash moves failed`),
              'Failed to move items to trash',
            )
          }
        })()
        return
      }

      if (event.key === 'F2' && selectedItems.length === 1) {
        event.preventDefault()
        openParentFolders(selectedItems[0]._id)
        setRenamingId(selectedItems[0]._id)
        return
      }

      if (event.key === 'Enter' && selectedItems.length === 1) {
        event.preventDefault()
        setLastSelectedItem(selectedItems[0].slug)
        void navigateToItem(selectedItems[0].slug)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activeItemSurface,
    activeItemsMap,
    campaignId,
    clearEditorContent,
    clearItemSelection,
    itemClipboard,
    itemOperations,
    moveItem,
    navigateToItem,
    openParentFolders,
    setSelectedItemIds,
    selectedItemIds,
    setItemClipboard,
    setLastSelectedItem,
    setRenamingId,
    trashedItemsMap,
  ])
}
