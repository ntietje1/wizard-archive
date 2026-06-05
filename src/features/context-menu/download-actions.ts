import { toast } from 'sonner'
import JSZip from 'jszip'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { useConvex } from '@convex-dev/react-query'
import type { ActionHandlers } from './menu-registry'
import type { MenuContext } from './types'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { handleError, logger } from '~/shared/utils/logger'
import { isFile, isGameMap, isNote } from '~/features/sidebar/utils/sidebar-item-utils'
import { convertBlocksToMarkdown } from '~/features/editor/utils/text-to-blocks'
import { assertNever } from '~/shared/utils/utils'

type ConvexClient = ReturnType<typeof useConvex>
type DownloadActions = Pick<ActionHandlers, 'downloadItems' | 'downloadAll'>

type DownloadZipItem =
  | { type: typeof SIDEBAR_ITEM_TYPES.files; downloadUrl: string | null; path: string }
  | { type: typeof SIDEBAR_ITEM_TYPES.gameMaps; downloadUrl: string | null; path: string }
  | {
      type: typeof SIDEBAR_ITEM_TYPES.notes
      content: Parameters<typeof convertBlocksToMarkdown>[0]
      path: string
    }

const DOWNLOAD_FETCH_TIMEOUT_MS = 30_000
type AddZipItemResult = { status: 'added' } | { status: 'failed' }

function ensureMdFileName(name: string) {
  return name.endsWith('.md') ? name : `${name}.md`
}

function sanitizeZipPath(path: string) {
  return path
    .split('/')
    .filter((part) => part.length > 0 && part !== '.' && part !== '..')
    .join('/')
}

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
  URL.revokeObjectURL(url)
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), DOWNLOAD_FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

async function addZipItem(zip: JSZip, item: DownloadZipItem): Promise<AddZipItemResult> {
  const path = sanitizeZipPath(item.path)
  if (!path) {
    logger.warn(`Skipping download item with invalid path: ${item.path}`)
    return { status: 'failed' }
  }

  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.files:
    case SIDEBAR_ITEM_TYPES.gameMaps: {
      if (!item.downloadUrl) {
        logger.warn(`No download URL for: ${item.path}`)
        return { status: 'failed' }
      }
      const response = await fetchWithTimeout(item.downloadUrl)
      if (!response.ok) {
        logger.warn(`Failed to fetch: ${item.path}`)
        return { status: 'failed' }
      }
      zip.file(path, await response.blob())
      return { status: 'added' }
    }
    case SIDEBAR_ITEM_TYPES.notes:
      zip.file(path, convertBlocksToMarkdown(item.content))
      return { status: 'added' }
    default:
      assertNever(item)
  }
}

async function downloadZip({
  items,
  fileName,
  emptyMessage,
}: {
  items: Array<DownloadZipItem>
  fileName: string
  emptyMessage: string
}) {
  if (items.length === 0) {
    toast.info(emptyMessage)
    return
  }

  const zip = new JSZip()
  const results = await Promise.all(
    items.map(async (item) => {
      try {
        return await addZipItem(zip, item)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          logger.warn(`Timed out fetching: ${item.path}`, error)
          return { status: 'failed' }
        }
        logger.warn(`Failed to process: ${item.path}`, error)
        return { status: 'failed' }
      }
    }),
  )
  const successCount = results.filter((result) => result.status === 'added').length
  const failureCount = results.length - successCount
  if (successCount === 0) {
    toast.error(`Failed to download ${failureCount} item(s)`)
    return
  }

  downloadBlob(await zip.generateAsync({ type: 'blob' }), fileName)
  if (failureCount > 0) {
    toast.info(`Downloaded ${successCount} item(s); ${failureCount} failed`)
  } else {
    toast.success(`Downloaded ${successCount} item(s)`)
  }
}

async function downloadSingleNote({
  campaignId,
  convex,
  item,
}: {
  campaignId: Id<'campaigns'>
  convex: ConvexClient
  item: AnySidebarItem
}) {
  const toastId = toast.loading('Preparing download...')
  try {
    const result = await convex.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId,
      sourceItemIds: [item._id],
    })
    const note = result.items[0]
    if (!note || note.type !== SIDEBAR_ITEM_TYPES.notes) {
      toast.error('Failed to load note content')
      return
    }
    downloadBlob(
      new Blob([convertBlocksToMarkdown(note.content)], { type: 'text/markdown' }),
      ensureMdFileName(note.name),
    )
    toast.success('Download started')
  } catch (error) {
    handleError(error, 'Failed to download note')
  } finally {
    toast.dismiss(toastId)
  }
}

async function downloadItemsArchive({
  campaignId,
  convex,
  items,
}: {
  campaignId: Id<'campaigns'>
  convex: ConvexClient
  items: Array<AnySidebarItem>
}) {
  const toastId = toast.loading('Preparing download...')
  try {
    const result = await convex.query(api.folders.queries.getSidebarItemsForDownload, {
      campaignId,
      sourceItemIds: items.map((downloadItem) => downloadItem._id),
    })
    toast.loading('Downloading items...', { id: toastId })
    await downloadZip({
      items: result.items,
      fileName: items.length === 1 ? `${items[0].name}.zip` : 'selected-items.zip',
      emptyMessage: 'No items to download',
    })
  } catch (error) {
    handleError(error, 'Failed to download')
  } finally {
    toast.dismiss(toastId)
  }
}

function downloadDirectUrl({
  url,
  fileName,
  missingUrlMessage,
  failureMessage,
}: {
  url: string | null
  fileName: string
  missingUrlMessage: string
  failureMessage: string
}) {
  if (!url) {
    toast.error(missingUrlMessage)
    return
  }

  try {
    downloadBlobUrl(url, fileName)
    toast.success('Download started')
  } catch (error) {
    handleError(error, failureMessage)
  }
}

export function createDownloadActions({
  campaignId,
  convex,
}: {
  campaignId: Id<'campaigns'> | undefined
  convex: ConvexClient
}): DownloadActions {
  return {
    downloadItems: async (ctx: MenuContext) => {
      const items = ctx.selectedItems ?? []
      if (!campaignId || items.length === 0) return
      const [item] = items

      if (items.length === 1 && item && isFile(item)) {
        downloadDirectUrl({
          url: item.downloadUrl,
          fileName: item.name,
          missingUrlMessage: 'Download URL not available',
          failureMessage: 'Failed to download file',
        })
        return
      }

      if (items.length === 1 && item && isGameMap(item)) {
        downloadDirectUrl({
          url: item.imageUrl,
          fileName: item.name,
          missingUrlMessage: 'Map image URL not available',
          failureMessage: 'Failed to download map',
        })
        return
      }

      if (items.length === 1 && item && isNote(item)) {
        await downloadSingleNote({ campaignId, convex, item })
        return
      }

      await downloadItemsArchive({ campaignId, convex, items })
    },

    downloadAll: async () => {
      if (!campaignId) return

      const toastId = toast.loading('Preparing download...')
      try {
        const { items } = await convex.query(api.folders.queries.getRootContentsForDownload, {
          campaignId,
        })
        toast.loading('Downloading items...', { id: toastId })
        await downloadZip({
          items,
          fileName: 'campaign-export.zip',
          emptyMessage: 'No items to download',
        })
      } catch (error) {
        handleError(error, 'Failed to download')
      } finally {
        toast.dismiss(toastId)
      }
    },
  }
}
