import { useState } from 'react'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceCommandResult } from './transaction-contract'
import type { ResourceTrashRequestResult } from './operation-runtime-contract'
import type { AnyItem, FolderItem } from '../workspace/items'
import { collectDescendantIdsFromItems } from './domain/tree'
import { FileSystemEmptyTrashDialog, FileSystemPermanentDeleteDialog } from './trash/dialogs'
import type { FileSystemTrashDialogState } from './trash/dialogs'
import { isFolderItem } from '../workspace/sidebar/utils/sidebar-item-types'
import { FolderDeleteConfirmDialog } from './trash/folder-confirm-dialog'
import type { FileSystemCacheAdapter } from './cache'
import { reportResourceCommandFailure } from './report-command-result'
import { handleError } from '../errors/handle-error'

type FileSystemDialogsArgs = {
  cacheAdapter: FileSystemCacheAdapter
  trashState: FileSystemTrashDialogState
  trashItems: (itemIds: Array<SidebarItemId>) => Promise<ResourceTrashRequestResult>
  deleteForever: (itemIds: Array<SidebarItemId>) => Promise<ResourceCommandResult | void>
  emptyTrash: () => Promise<ResourceCommandResult | void>
}

export function useFileSystemDialogs({
  cacheAdapter,
  trashState,
  trashItems,
  deleteForever,
  emptyTrash,
}: FileSystemDialogsArgs) {
  const [pendingDeleteForeverItems, setPendingDeleteForeverItems] = useState<Array<AnyItem> | null>(
    null,
  )
  const [pendingEmptyTrash, setPendingEmptyTrash] = useState(false)
  const [pendingTrashFolder, setPendingTrashFolder] = useState<FolderItem | null>(null)
  const [activeTrashCommand, setActiveTrashCommand] = useState<'delete' | 'empty' | null>(null)

  const requestTrashFolder = (folder: FolderItem) => {
    setPendingTrashFolder(folder)
  }

  const deleteForeverDialog = pendingDeleteForeverItems ? (
    <FileSystemPermanentDeleteDialog
      items={pendingDeleteForeverItems}
      trashState={trashState}
      onClose={() => setPendingDeleteForeverItems(null)}
      onConfirm={async () => {
        if (activeTrashCommand) return
        const itemIds = pendingDeleteForeverItems.map((item) => item.id)
        setActiveTrashCommand('delete')
        try {
          const result = await deleteForever(itemIds)
          if (result?.status === 'completed') setPendingDeleteForeverItems(null)
          else if (result) {
            reportResourceCommandFailure(result, 'Failed to permanently delete items')
          }
        } catch (error) {
          handleError(error, 'Failed to permanently delete items')
        } finally {
          setActiveTrashCommand(null)
        }
      }}
    />
  ) : null

  const emptyTrashDialog = pendingEmptyTrash ? (
    <FileSystemEmptyTrashDialog
      trashState={trashState}
      onClose={() => setPendingEmptyTrash(false)}
      onConfirm={async () => {
        if (activeTrashCommand) return
        setActiveTrashCommand('empty')
        try {
          const result = await emptyTrash()
          if (result?.status === 'completed') setPendingEmptyTrash(false)
          else if (result) reportResourceCommandFailure(result, 'Failed to empty trash')
        } catch (error) {
          handleError(error, 'Failed to empty trash')
        } finally {
          setActiveTrashCommand(null)
        }
      }}
    />
  ) : null

  const trashFolderDialog =
    pendingTrashFolder && isFolderItem(pendingTrashFolder) ? (
      <FolderDeleteConfirmDialog
        descendantCount={
          collectDescendantIdsFromItems(pendingTrashFolder.id, cacheAdapter.getSnapshot().sidebar)
            .size
        }
        key={`trash-folder-${pendingTrashFolder.id}`}
        isDeleting={true}
        onTrash={async () => {
          const itemId = pendingTrashFolder.id
          try {
            const result = await trashItems([itemId])
            if (result.status === 'completed') {
              setPendingTrashFolder(null)
            } else if (result.status === 'pending' || result.status === 'noop') {
              handleError(
                new Error(`Trash items returned ${result.status}`),
                'Failed to trash folder',
              )
            } else {
              reportResourceCommandFailure(result, 'Failed to trash folder')
            }
          } catch (error) {
            handleError(error, 'Failed to trash folder')
          }
        }}
        onClose={() => setPendingTrashFolder(null)}
      />
    ) : null

  return {
    requestTrashFolder,
    requestDeleteForever: setPendingDeleteForeverItems,
    requestEmptyTrash: () => setPendingEmptyTrash(true),
    dialog: (
      <>
        {deleteForeverDialog}
        {emptyTrashDialog}
        {trashFolderDialog}
      </>
    ),
  }
}
