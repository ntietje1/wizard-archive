import { useRef, useState } from 'react'
import type { AnyItem } from '../../items'
import type { MaybePromise } from '../../../../../../shared/common/async'
import { handleError } from '../../../errors/handle-error'
import { reportResourceCommandFailure } from '../../../filesystem/report-command-result'
import { TrashPopoverSurface } from './trash-popover-surface'
import { useItemSurfaceRegistration } from '../use-item-surface-registration'
import { getSidebarItemIcon } from '../item-icons'
import { DraggableSidebarItem } from './sidebar-item/draggable-sidebar-item'
import type { TrashSource } from '../../../filesystem/trash/source'

export type TrashPopoverContentSource = Pick<
  TrashSource,
  | 'canDragItem'
  | 'canDeleteItemForever'
  | 'canEmptyTrash'
  | 'canRestoreItem'
  | 'getSidebarDragData'
  | 'getRootItems'
  | 'openItem'
  | 'openTrash'
  | 'requestDeleteItemsForever'
  | 'requestEmptyTrash'
  | 'restoreItems'
>

interface TrashPopoverContentProps {
  onClose: () => void
  source: TrashPopoverContentSource
}

const EMPTY_TRASH_ACTION_KEY = 'empty-trash'
const OPEN_TRASH_ACTION_KEY = 'open-trash'

function trashItemMutationActionKey(itemId: AnyItem['id']) {
  return `trash-item:${itemId}`
}

function openItemActionKey(itemId: AnyItem['id']) {
  return `open-item:${itemId}`
}

function getDeletionTimeLabel(item: AnyItem) {
  const dt = item.deletionTime
  if (dt === null || dt === undefined) return ''
  return new Date(dt).toLocaleDateString()
}

export function TrashPopoverContent({ onClose, source }: TrashPopoverContentProps) {
  const pendingActionKeysRef = useRef<ReadonlySet<string> | null>(null)
  const [pendingActionKeys, setPendingActionKeys] = useState<ReadonlySet<string>>(() => new Set())
  const rootTrashedItems = source.getRootItems()
  const visibleItemIds = rootTrashedItems.map((item) => item.id)
  const { activateSurface, handleSurfacePointerDown, itemSurfaceHotkeyProps } =
    useItemSurfaceRegistration({
      surface: 'trash',
      parentId: null,
      visibleItemIds,
    })

  const getPendingActionKeys = () => {
    let keys = pendingActionKeysRef.current
    if (keys === null) {
      keys = new Set()
      pendingActionKeysRef.current = keys
    }
    return keys
  }

  const setActionPending = (key: string, pending: boolean) => {
    const nextKeys = new Set(getPendingActionKeys())
    if (pending) {
      nextKeys.add(key)
    } else {
      nextKeys.delete(key)
    }
    pendingActionKeysRef.current = nextKeys
    setPendingActionKeys(nextKeys)
  }

  const runSingleFlightAction = async <T,>(
    key: string,
    action: () => MaybePromise<T>,
    errorMessage: string,
  ) => {
    const pendingKeys = getPendingActionKeys()
    if (pendingKeys.has(key)) return

    setActionPending(key, true)
    try {
      await action()
    } catch (error) {
      handleError(error, errorMessage)
    } finally {
      setActionPending(key, false)
    }
  }

  const isActionPending = (key: string) => pendingActionKeys.has(key)
  const emptyTrashPending = isActionPending(EMPTY_TRASH_ACTION_KEY)
  const trashItemMutationPending = rootTrashedItems.some((item) =>
    isActionPending(trashItemMutationActionKey(item.id)),
  )

  const handleRestore = async (item: AnyItem) => {
    if (emptyTrashPending) return
    await runSingleFlightAction(
      trashItemMutationActionKey(item.id),
      async () => {
        const result = await source.restoreItems([item.id], null)
        reportResourceCommandFailure(result, 'Failed to restore item')
      },
      'Failed to restore item',
    )
  }

  const handlePermanentDelete = async (item: AnyItem) => {
    if (emptyTrashPending) return
    await runSingleFlightAction(
      trashItemMutationActionKey(item.id),
      () => source.requestDeleteItemsForever([item.id]),
      'Failed to permanently delete item',
    )
  }

  const handleEmptyTrash = async () => {
    if (trashItemMutationPending) return
    await runSingleFlightAction(
      EMPTY_TRASH_ACTION_KEY,
      source.requestEmptyTrash,
      'Failed to empty trash',
    )
  }

  const handleOpenTrash = async () => {
    await runSingleFlightAction(
      OPEN_TRASH_ACTION_KEY,
      async () => {
        await source.openTrash()
        onClose()
      },
      'Failed to open trash',
    )
  }

  const handleOpenItem = async (item: AnyItem) => {
    await runSingleFlightAction(
      openItemActionKey(item.id),
      async () => {
        await source.openItem(item.id)
        onClose()
      },
      'Failed to open item',
    )
  }

  return (
    <div
      className="group/sidebar-surface"
      onFocusCapture={activateSurface}
      onPointerDownCapture={handleSurfacePointerDown}
      onContextMenuCapture={activateSurface}
      {...itemSurfaceHotkeyProps}
    >
      <TrashPopoverSurface
        items={rootTrashedItems.map((item) => {
          const itemMutationPending = isActionPending(trashItemMutationActionKey(item.id))
          const actionPending = emptyTrashPending || itemMutationPending
          return {
            id: item.id,
            icon: getSidebarItemIcon(item),
            name: item.name,
            deletedLabel: getDeletionTimeLabel(item),
            canRestore: source.canRestoreItem(item),
            canDeleteForever: source.canDeleteItemForever(item),
            restorePending: actionPending,
            deleteForeverPending: actionPending,
          }
        })}
        canEmptyTrash={source.canEmptyTrash()}
        emptyTrashPending={trashItemMutationPending || emptyTrashPending}
        openFullPagePending={isActionPending(OPEN_TRASH_ACTION_KEY)}
        onOpenFullPage={() => void handleOpenTrash()}
        onItemClick={(surfaceItem) => {
          const item = rootTrashedItems.find((candidate) => candidate.id === surfaceItem.id)
          if (!item) return
          void handleOpenItem(item)
        }}
        onRestore={(surfaceItem) => {
          const item = rootTrashedItems.find((candidate) => candidate.id === surfaceItem.id)
          if (item) void handleRestore(item)
        }}
        onDeleteForever={(surfaceItem) => {
          const item = rootTrashedItems.find((candidate) => candidate.id === surfaceItem.id)
          if (item) void handlePermanentDelete(item)
        }}
        onEmptyTrash={() => void handleEmptyTrash()}
        renderItemWrapper={(surfaceItem, row) => {
          const item = rootTrashedItems.find((candidate) => candidate.id === surfaceItem.id)
          if (!item) return row

          return (
            <DraggableSidebarItem
              canDrag={source.canDragItem(item)}
              disabled={emptyTrashPending || isActionPending(trashItemMutationActionKey(item.id))}
              dragDataSource={source}
              item={item}
            >
              {row}
            </DraggableSidebarItem>
          )
        }}
      />
    </div>
  )
}
