import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import JSZip from 'jszip'
import type { FileSystemDownload } from '../../../filesystem/download'
import { RESOURCE_TYPES } from '../../items-persistence-contract'
import type { WorkspaceMenuContext } from '../../menu-context'
import { VIEW_CONTEXT } from '../../view-context'
import type { WorkspaceDownloadContextMenuActions } from '../download-menu'
import { createDownloadActions } from '../actions/download-actions'
import { createFile, createGameMap, createNote } from '../../../test/sidebar-item-factory'

type AvailableFileSystemDownload = Extract<FileSystemDownload, { status: 'available' }>
type FileSystemDownloadItem = Awaited<
  ReturnType<AvailableFileSystemDownload['loadRootItemsForDownload']>
>['items'][number]

const { toastDismiss, toastError, toastInfo, toastLoading, toastSuccess } = vi.hoisted(() => ({
  toastDismiss: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastLoading: vi.fn(() => 'toast-1'),
  toastSuccess: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    dismiss: toastDismiss,
    error: toastError,
    info: toastInfo,
    loading: toastLoading,
    success: toastSuccess,
  },
}))

const clickedDownloadNames: Array<string> = []

describe('createDownloadActions', () => {
  beforeEach(() => {
    toastDismiss.mockClear()
    toastError.mockClear()
    toastInfo.mockClear()
    toastLoading.mockClear()
    toastSuccess.mockClear()
    clickedDownloadNames.length = 0
    vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(function click(this: HTMLElement) {
      if (this instanceof HTMLAnchorElement) clickedDownloadNames.push(this.download)
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(blobResponse('file contents'))),
    )
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:download'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reports partial archive failures instead of presenting the export as fully successful', async () => {
    const actions = createDownloadActions({
      dataSource: createDownloadDataSource({
        items: [
          downloadFileItem({
            downloadUrl: 'https://example.com/file.txt',
            path: 'file.txt',
          }),
          downloadFileItem({ downloadUrl: null, path: 'missing.txt' }),
        ],
      }),
    })

    await runDownloadAll(actions.downloadAll)

    expect(toastInfo).toHaveBeenCalledWith('Downloaded 1 item(s); 1 failed', { id: 'toast-1' })
    expect(toastDismiss).not.toHaveBeenCalled()
  })

  it('reports all archive item failures as a failed download', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:download'),
      revokeObjectURL: vi.fn(),
    })
    const actions = createDownloadActions({
      dataSource: createDownloadDataSource({
        items: [downloadFileItem({ downloadUrl: null, path: 'missing.txt' })],
      }),
    })

    const result = await runDownloadAll(actions.downloadAll)

    expect(toastError).toHaveBeenCalledWith('Failed to download 1 item(s)', { id: 'toast-1' })
    expect(toastDismiss).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'error', error: expect.any(Error) })
  })

  it('fetches archive file blobs concurrently and writes ZIP entries in source order', async () => {
    const events: Array<string> = []
    let resolveFirstFetchStarted: () => void
    const firstFetchStarted = new Promise<void>((resolve) => {
      resolveFirstFetchStarted = resolve
    })
    let resolveSecondFetchFinished: () => void
    const secondFetchFinished = new Promise<void>((resolve) => {
      resolveSecondFetchFinished = resolve
    })
    let releaseFirstFetch: (() => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = readFetchUrl(input)
        events.push(`start:${url}`)
        if (url.includes('first')) {
          resolveFirstFetchStarted()
          await new Promise<void>((resolve) => {
            releaseFirstFetch = resolve
          })
        }
        events.push(`finish:${url}`)
        if (url.includes('second')) {
          resolveSecondFetchFinished()
        }
        return blobResponse(url)
      }),
    )
    const actions = createDownloadActions({
      dataSource: createDownloadDataSource({
        items: [
          downloadFileItem({
            downloadUrl: 'https://example.com/first.txt',
            path: 'first.txt',
          }),
          downloadFileItem({
            downloadUrl: 'https://example.com/second.txt',
            path: 'second.txt',
          }),
        ],
      }),
    })

    const downloadPromise = runDownloadAll(actions.downloadAll)
    await firstFetchStarted
    await secondFetchFinished
    if (!releaseFirstFetch) {
      throw new Error('Expected the first archive fetch to start')
    }
    releaseFirstFetch()
    await downloadPromise

    expect(events).toEqual([
      'start:https://example.com/first.txt',
      'start:https://example.com/second.txt',
      'finish:https://example.com/second.txt',
      'finish:https://example.com/first.txt',
    ])
    const archive = await readDownloadedArchive()
    expect(getArchiveFilePaths(archive)).toEqual(['first.txt', 'second.txt'])
  })

  it('normalizes unsafe archive paths before adding ZIP entries', async () => {
    const actions = createDownloadActions({
      dataSource: createDownloadDataSource({
        items: [
          downloadFileItem({
            downloadUrl: 'https://example.com/loot.txt',
            path: 'C:\\campaign\\..\\Scenes\\.\\loot.txt',
          }),
        ],
      }),
    })

    await runDownloadAll(actions.downloadAll)

    const archive = await readDownloadedArchive()
    expect(getArchiveFilePaths(archive)).toEqual(['campaign/Scenes/loot.txt'])
  })

  it('keeps generated blob URLs alive until after the download click starts', async () => {
    vi.useFakeTimers()
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:download'),
      revokeObjectURL,
    })
    const note = createNote({ name: 'Scene' })
    const actions = createDownloadActions({
      dataSource: createDownloadDataSource({
        items: [downloadNoteItem({ name: 'Scene', path: 'Scene.md' })],
      }),
    })

    await actions.downloadItems({ ...archiveContext, item: note, selectedItems: [note] })

    expect(revokeObjectURL).not.toHaveBeenCalled()
    await vi.runOnlyPendingTimersAsync()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download')
  })

  it('sanitizes direct download filenames before assigning them to the browser download', async () => {
    const file = createFile({ name: 'ignored' })
    const dataSource = createDownloadDataSource({
      items: [
        downloadFileItem({
          downloadUrl: 'https://example.com/file.txt',
          name: '..\\unsafe/folder/secret.txt',
          path: 'secret.txt',
        }),
      ],
    })
    const actions = createDownloadActions({
      dataSource,
    })

    await actions.downloadItems({ ...archiveContext, item: file, selectedItems: [file] })

    expect(dataSource.loadItemsForDownload).toHaveBeenCalledWith({
      itemIds: [file.id],
      items: [file],
    })
    expect(clickedDownloadNames).toEqual(['secret.txt'])
  })

  it('passes the selected map projection through the download source', async () => {
    const map = createGameMap({ name: 'Map' })
    const selectedMap = { ...map, imageUrl: 'active-layer-url' }
    const dataSource = createDownloadDataSource({
      items: [
        downloadMapItem({
          downloadUrl: 'active-layer-url',
          name: 'Map',
          path: 'Map',
        }),
      ],
    })
    const actions = createDownloadActions({ dataSource })

    await actions.downloadItems({ ...archiveContext, item: map, selectedItems: [selectedMap] })

    expect(dataSource.loadItemsForDownload).toHaveBeenCalledWith({
      itemIds: [map.id],
      items: [selectedMap],
    })
    expect(clickedDownloadNames).toEqual(['Map'])
  })

  it('returns unsupported download sources instead of silently no-oping', async () => {
    const actions = createDownloadActions({
      dataSource: { status: 'unsupported', reason: 'not_available' },
    })

    await expect(runDownloadAll(actions.downloadAll)).resolves.toEqual({
      status: 'unsupported',
      reason: 'not_available',
    })
    await expect(actions.downloadItems(archiveContext)).resolves.toEqual({
      status: 'unsupported',
      reason: 'not_available',
    })
    expect(toastLoading).not.toHaveBeenCalled()
  })
})

function createDownloadDataSource(result: {
  items: Array<FileSystemDownloadItem>
}): AvailableFileSystemDownload {
  const completedResult = {
    status: 'completed' as const,
    receipt: {
      kind: 'downloadPrepared' as const,
      affectedCount: result.items.length,
    },
    items: result.items,
    skippedItems: [],
  }
  const loadItemsForDownload: AvailableFileSystemDownload['loadItemsForDownload'] = vi.fn(() =>
    Promise.resolve(completedResult),
  )
  const loadRootItemsForDownload: AvailableFileSystemDownload['loadRootItemsForDownload'] = vi.fn(
    () => Promise.resolve(completedResult),
  )

  return {
    status: 'available',
    loadItemsForDownload,
    loadRootItemsForDownload,
  }
}

function downloadFileItem({
  downloadUrl,
  path,
  name = path,
}: {
  downloadUrl: string | null
  path: string
  name?: string
}): FileSystemDownloadItem {
  return {
    type: RESOURCE_TYPES.files,
    downloadUrl,
    name,
    path,
  }
}

function downloadMapItem({
  downloadUrl,
  path,
  name = path,
}: {
  downloadUrl: string | null
  path: string
  name?: string
}): FileSystemDownloadItem {
  return {
    type: RESOURCE_TYPES.gameMaps,
    downloadUrl,
    name,
    path,
  }
}

function downloadNoteItem({
  path,
  name = path,
}: {
  path: string
  name?: string
}): FileSystemDownloadItem {
  return {
    type: RESOURCE_TYPES.notes,
    content: [],
    name,
    path,
  }
}

async function runDownloadAll(downloadAll: WorkspaceDownloadContextMenuActions['downloadAll']) {
  return await downloadAll(archiveContext)
}

const archiveContext: WorkspaceMenuContext = {
  item: undefined,
  selectedItems: [],
  surface: VIEW_CONTEXT.SIDEBAR,
}

function readFetchUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function blobResponse(content: string): Response {
  return {
    ok: true,
    blob: () => Promise.resolve(new Blob([content])),
  } as Response
}

async function readDownloadedArchive() {
  const createObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')?.value as
    | CreateObjectURLMock
    | undefined
  if (!createObjectURL) {
    throw new Error('Expected URL.createObjectURL to be mocked')
  }
  const archiveBlob = createObjectURL.mock.calls[0]?.[0]
  if (!(archiveBlob instanceof Blob)) {
    throw new Error('Expected an archive blob to be downloaded')
  }
  return await JSZip.loadAsync(archiveBlob)
}

type CreateObjectURLMock = {
  mock: {
    calls: Array<[Blob | MediaSource]>
  }
}

function getArchiveFilePaths(archive: JSZip) {
  return Object.values(archive.files)
    .filter((file) => !file.dir)
    .map((file) => file.name)
}
