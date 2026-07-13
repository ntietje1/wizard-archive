import JSZip from 'jszip'
import { convertBlocksToMarkdown } from '../notes/document/text-to-blocks'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { FileSystemDownloadItem } from './download'

export interface FileSystemDownloadIo {
  clearTimeout: (timeoutId: FileSystemDownloadTimeoutId) => void
  fetch: (url: string, init: { signal: AbortSignal }) => Promise<Response>
  setTimeout: (callback: () => void, delayMs: number) => FileSystemDownloadTimeoutId
}

export type FileSystemDownloadPayload = { kind: 'blob'; blob: Blob } | { kind: 'url'; url: string }

type FileSystemDownloadTimeoutId = number | ReturnType<typeof setTimeout>

type PreparedSingleDownload =
  | { status: 'completed'; fileName: string; payload: FileSystemDownloadPayload }
  | { status: 'unavailable'; reason: string }

type PreparedArchiveDownload =
  | {
      status: 'completed'
      payload: Extract<FileSystemDownloadPayload, { kind: 'blob' }>
      successCount: number
      failureCount: number
    }
  | { status: 'empty' }
  | { status: 'failed'; failureCount: number }

type PrepareZipItemResult =
  | { status: 'added'; path: string; content: Blob | string }
  | { status: 'failed' }

const DOWNLOAD_FETCH_TIMEOUT_MS = 30_000
const ZIP_DOWNLOAD_CONCURRENCY = 4

export function createBrowserFileSystemDownloadIo(): FileSystemDownloadIo {
  return {
    clearTimeout: (timeoutId) => window.clearTimeout(timeoutId as number),
    fetch: (url, init) => fetch(url, init),
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  }
}

export function prepareSingleFileSystemDownload(
  item: FileSystemDownloadItem,
): PreparedSingleDownload {
  switch (item.type) {
    case RESOURCE_TYPES.files:
    case RESOURCE_TYPES.gameMaps:
      if (!item.downloadUrl) {
        return { status: 'unavailable', reason: 'download_url_unavailable' }
      }
      return {
        status: 'completed',
        fileName: sanitizeDownloadFileName(item.name, 'download'),
        payload: { kind: 'url', url: item.downloadUrl },
      }
    case RESOURCE_TYPES.notes:
      return {
        status: 'completed',
        fileName: sanitizeDownloadFileName(ensureMarkdownFileName(item.name), 'note.md'),
        payload: {
          kind: 'blob',
          blob: new Blob([convertBlocksToMarkdown(item.content)], { type: 'text/markdown' }),
        },
      }
    case RESOURCE_TYPES.canvases:
      return {
        status: 'completed',
        fileName: sanitizeDownloadFileName(ensureCanvasFileName(item.name), 'canvas.json'),
        payload: {
          kind: 'blob',
          blob: new Blob([JSON.stringify(item.content, null, 2)], { type: 'application/json' }),
        },
      }
    default:
      return assertNever(item)
  }
}

export async function prepareFileSystemDownloadArchive({
  io,
  items,
}: {
  io: FileSystemDownloadIo
  items: Array<FileSystemDownloadItem>
}): Promise<PreparedArchiveDownload> {
  if (items.length === 0) return { status: 'empty' }

  const zip = new JSZip()
  const results = await prepareZipItems({ io, items })
  const writtenPaths = new Set<string>()
  let successCount = 0
  for (const result of results) {
    if (result.status !== 'added' || writtenPaths.has(result.path)) continue
    writtenPaths.add(result.path)
    zip.file(result.path, result.content)
    successCount += 1
  }
  const failureCount = results.length - successCount
  if (successCount === 0) return { status: 'failed', failureCount }

  return {
    status: 'completed',
    payload: { kind: 'blob', blob: await zip.generateAsync({ type: 'blob' }) },
    successCount,
    failureCount,
  }
}

export function sanitizeDownloadFileName(name: string, fallback: string) {
  const sanitizedPath = sanitizeZipPath(name)
  const fileName = sanitizedPath.split('/').at(-1)
  return fileName && fileName.length > 0 ? fileName : fallback
}

async function prepareZipItems({
  io,
  items,
}: {
  io: FileSystemDownloadIo
  items: Array<FileSystemDownloadItem>
}): Promise<Array<PrepareZipItemResult>> {
  return await mapWithConcurrency(items, ZIP_DOWNLOAD_CONCURRENCY, async (item) => {
    try {
      return await prepareZipItem({ io, item })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.warn(`Timed out fetching: ${item.path}`, error)
        return { status: 'failed' }
      }
      console.warn(`Failed to process: ${item.path}`, error)
      return { status: 'failed' }
    }
  })
}

async function prepareZipItem({
  io,
  item,
}: {
  io: FileSystemDownloadIo
  item: FileSystemDownloadItem
}): Promise<PrepareZipItemResult> {
  const path = sanitizeZipPath(item.path)
  if (!path) {
    console.warn(`Skipping download item with invalid path: ${item.path}`)
    return { status: 'failed' }
  }

  switch (item.type) {
    case RESOURCE_TYPES.files:
    case RESOURCE_TYPES.gameMaps: {
      if (!item.downloadUrl) {
        console.warn(`No download URL for: ${item.path}`)
        return { status: 'failed' }
      }
      const { blob, response } = await fetchWithTimeout({ io, url: item.downloadUrl })
      if (!response.ok) {
        console.warn(`Failed to fetch: ${item.path}`)
        return { status: 'failed' }
      }
      return { status: 'added', path, content: blob }
    }
    case RESOURCE_TYPES.notes:
      return { status: 'added', path, content: convertBlocksToMarkdown(item.content) }
    case RESOURCE_TYPES.canvases:
      return {
        status: 'added',
        path,
        content: JSON.stringify(item.content, null, 2),
      }
    default:
      return assertNever(item)
  }
}

async function fetchWithTimeout({ io, url }: { io: FileSystemDownloadIo; url: string }) {
  const controller = new AbortController()
  const timeout = io.setTimeout(() => controller.abort(), DOWNLOAD_FETCH_TIMEOUT_MS)
  try {
    const response = await io.fetch(url, { signal: controller.signal })
    return { response, blob: response.ok ? await response.blob() : new Blob() }
  } finally {
    io.clearTimeout(timeout)
  }
}

async function mapWithConcurrency<T, TResult>(
  values: Array<T>,
  concurrency: number,
  mapper: (value: T) => Promise<TResult>,
): Promise<Array<TResult>> {
  const results: Array<TResult> = []
  let nextIndex = 0

  async function worker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(values[currentIndex])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return results
}

function sanitizeZipPath(path: string) {
  return path
    .replaceAll('\\', '/')
    .replace(/^[A-Za-z]:/, '')
    .split('/')
    .filter((part) => part.length > 0 && part !== '.' && part !== '..')
    .join('/')
}

function ensureMarkdownFileName(name: string) {
  return name.endsWith('.md') ? name : `${name}.md`
}

function ensureCanvasFileName(name: string) {
  return name.endsWith('.canvas.json') ? name : `${name}.canvas.json`
}

function assertNever(value: never): never {
  throw new Error(`Unexpected download item: ${JSON.stringify(value)}`)
}
