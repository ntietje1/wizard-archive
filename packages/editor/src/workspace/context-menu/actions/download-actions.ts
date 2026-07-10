import { toast } from 'sonner'
import type { AnyItem } from '../../items'
import type { WorkspaceMenuContext } from '../../menu-context'
import { handleError } from '../../../errors/handle-error'
import { isFileItem, isMapItem, isNoteItem } from '../../sidebar/utils/sidebar-item-types'
import type { FileSystemDownload, FileSystemDownloadResult } from '../../../filesystem/download'
import {
  createBrowserFileSystemDownloadIo,
  prepareFileSystemDownloadArchive,
  prepareSingleFileSystemDownload,
  sanitizeDownloadFileName,
} from '../../../filesystem/download-artifacts'
import type {
  FileSystemDownloadIo,
  FileSystemDownloadPayload,
} from '../../../filesystem/download-artifacts'
import type { WorkspaceDownloadContextMenuActions } from '../download-menu'

type AvailableFileSystemDownload = Extract<FileSystemDownload, { status: 'available' }>
type WorkspaceDownloadActionResult = Awaited<
  ReturnType<WorkspaceDownloadContextMenuActions['downloadItems']>
>

function downloadBlobUrl(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  downloadBlobUrl(url, fileName)
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function downloadZip({
  browserIo,
  items,
  fileName,
  emptyMessage,
}: {
  browserIo: FileSystemDownloadIo
  items: Extract<FileSystemDownloadResult, { status: 'completed' }>['items']
  fileName: string
  emptyMessage: string
}) {
  const archive = await prepareFileSystemDownloadArchive({ io: browserIo, items })
  if (archive.status === 'empty') {
    toast.info(emptyMessage)
    return
  }
  if (archive.status === 'failed') {
    toast.error(`Failed to download ${archive.failureCount} item(s)`)
    return
  }

  downloadPayload(archive.payload, fileName)
  if (archive.failureCount > 0) {
    toast.info(`Downloaded ${archive.successCount} item(s); ${archive.failureCount} failed`)
  } else {
    toast.success(`Downloaded ${archive.successCount} item(s)`)
  }
}

function downloadPayload(payload: FileSystemDownloadPayload, fileName: string) {
  if (payload.kind === 'url') {
    downloadBlobUrl(payload.url, fileName)
    return
  }
  downloadBlob(payload.blob, fileName)
}

async function downloadSingleItem({
  dataSource,
  item,
  missingItemMessage,
}: {
  dataSource: AvailableFileSystemDownload
  item: AnyItem
  missingItemMessage: string
}): Promise<WorkspaceDownloadActionResult> {
  const toastId = toast.loading('Preparing download...')
  try {
    const result = await loadCompletedDownloadItems(
      dataSource.loadItemsForDownload({
        itemIds: [item.id],
        items: [item],
      }),
    )
    const [downloadItem] = result.items
    if (!downloadItem) {
      toast.error(missingItemMessage)
      return { status: 'unavailable', reason: 'download_item_unavailable' }
    }
    const preparedDownload = prepareSingleFileSystemDownload(downloadItem)
    if (preparedDownload.status !== 'completed') {
      toast.error(missingItemMessage)
      return { status: 'unavailable', reason: preparedDownload.reason }
    }
    downloadPayload(preparedDownload.payload, preparedDownload.fileName)
    toast.success('Download started')
    return { status: 'completed' }
  } catch (error) {
    handleError(error, 'Failed to download')
    return { status: 'error', error }
  } finally {
    toast.dismiss(toastId)
  }
}

async function downloadItemsArchive({
  browserIo,
  dataSource,
  items,
}: {
  browserIo: FileSystemDownloadIo
  dataSource: AvailableFileSystemDownload
  items: Array<AnyItem>
}): Promise<WorkspaceDownloadActionResult> {
  const toastId = toast.loading('Preparing download...')
  try {
    const result = await loadCompletedDownloadItems(
      dataSource.loadItemsForDownload({
        itemIds: items.map((downloadItem) => downloadItem.id),
        items,
      }),
    )
    toast.loading('Downloading items...', { id: toastId })
    await downloadZip({
      browserIo,
      items: result.items,
      fileName:
        items.length === 1
          ? sanitizeDownloadFileName(`${items[0].name}.zip`, 'selected-item.zip')
          : 'selected-items.zip',
      emptyMessage: 'No items to download',
    })
    return { status: 'completed' }
  } catch (error) {
    handleError(error, 'Failed to download')
    return { status: 'error', error }
  } finally {
    toast.dismiss(toastId)
  }
}

async function loadCompletedDownloadItems(
  resultPromise: Promise<FileSystemDownloadResult>,
): Promise<Extract<FileSystemDownloadResult, { status: 'completed' }>> {
  const result = await resultPromise
  if (result.status === 'completed') return result
  throw result.status === 'error'
    ? (result.error ?? new Error('Download failed'))
    : new Error(`Download unavailable: ${result.reason}`)
}

export function createDownloadActions({
  browserIo = createBrowserFileSystemDownloadIo(),
  dataSource,
}: {
  browserIo?: FileSystemDownloadIo
  dataSource: FileSystemDownload
}): WorkspaceDownloadContextMenuActions {
  return {
    downloadItems: async (ctx: WorkspaceMenuContext) => {
      const items = ctx.selectedItems
      if (dataSource.status !== 'available') return dataSource
      if (items.length === 0) return { status: 'unavailable', reason: 'no_items_selected' }
      const [item] = items

      if (items.length === 1 && item && isFileItem(item)) {
        return await downloadSingleItem({
          dataSource,
          item,
          missingItemMessage: 'Download URL not available',
        })
      }

      if (items.length === 1 && item && isMapItem(item)) {
        return await downloadSingleItem({
          dataSource,
          item,
          missingItemMessage: 'Map image URL not available',
        })
      }

      if (items.length === 1 && item && isNoteItem(item)) {
        return await downloadSingleItem({
          dataSource,
          item,
          missingItemMessage: 'Failed to load note content',
        })
      }

      return await downloadItemsArchive({ browserIo, dataSource, items })
    },

    downloadAll: async () => {
      if (dataSource.status !== 'available') return dataSource

      const toastId = toast.loading('Preparing download...')
      try {
        const { items } = await loadCompletedDownloadItems(dataSource.loadRootItemsForDownload())
        toast.loading('Downloading items...', { id: toastId })
        await downloadZip({
          browserIo,
          items,
          fileName: 'workspace-export.zip',
          emptyMessage: 'No items to download',
        })
        return { status: 'completed' }
      } catch (error) {
        handleError(error, 'Failed to download')
        return { status: 'error', error }
      } finally {
        toast.dismiss(toastId)
      }
    },
  }
}
