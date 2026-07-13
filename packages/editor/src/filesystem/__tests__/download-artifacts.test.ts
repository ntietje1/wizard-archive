import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { FileSystemDownloadItem } from '../download'
import {
  prepareFileSystemDownloadArchive,
  prepareSingleFileSystemDownload,
} from '../download-artifacts'
import type { FileSystemDownloadIo } from '../download-artifacts'

describe('download artifacts', () => {
  it('creates archive blobs with sanitized paths and source-order entries', async () => {
    const io = createDownloadIo()

    const archive = await prepareFileSystemDownloadArchive({
      io,
      items: [
        downloadFileItem({
          downloadUrl: 'https://example.com/first.txt',
          path: 'C:\\campaign\\..\\Scenes\\.\\first.txt',
        }),
        downloadNoteItem({ path: 'notes/Session.md' }),
      ],
    })

    expect(archive).toMatchObject({
      status: 'completed',
      successCount: 2,
      failureCount: 0,
    })
    if (archive.status !== 'completed') throw new Error('Expected completed archive')
    const zip = await JSZip.loadAsync(archive.payload.blob)
    expect(getArchiveFilePaths(zip)).toEqual(['campaign/Scenes/first.txt', 'notes/Session.md'])
  })

  it('reports partial archive failures without hiding successful entries', async () => {
    const archive = await prepareFileSystemDownloadArchive({
      io: createDownloadIo(),
      items: [
        downloadFileItem({ downloadUrl: 'https://example.com/handout.txt', path: 'handout.txt' }),
        downloadFileItem({ downloadUrl: null, path: 'missing.txt' }),
      ],
    })

    expect(archive).toMatchObject({
      status: 'completed',
      successCount: 1,
      failureCount: 1,
    })
  })

  it('reports archive entries that collapse to the same sanitized path as failures', async () => {
    const archive = await prepareFileSystemDownloadArchive({
      io: createDownloadIo(),
      items: [
        downloadNoteItem({ path: 'notes/Session.md' }),
        downloadNoteItem({ path: 'notes/./Session.md' }),
      ],
    })

    expect(archive).toMatchObject({ status: 'completed', successCount: 1, failureCount: 1 })
    if (archive.status !== 'completed') throw new Error('Expected completed archive')
    const zip = await JSZip.loadAsync(archive.payload.blob)
    expect(getArchiveFilePaths(zip)).toEqual(['notes/Session.md'])
  })

  it('keeps the fetch timeout active while reading the response body', async () => {
    vi.useFakeTimers()
    const io: FileSystemDownloadIo = {
      clearTimeout,
      fetch: vi.fn((_url: string, { signal }: RequestInit = {}) =>
        Promise.resolve({
          ok: true,
          blob: () =>
            new Promise<Blob>((_resolve, reject) => {
              signal?.addEventListener('abort', () =>
                reject(new DOMException('Download timed out', 'AbortError')),
              )
            }),
        } as Response),
      ),
      setTimeout,
    }

    try {
      const archivePromise = prepareFileSystemDownloadArchive({
        io,
        items: [downloadFileItem({ downloadUrl: 'https://example.com/slow', path: 'slow' })],
      })
      await vi.runAllTimersAsync()

      await expect(archivePromise).resolves.toMatchObject({
        status: 'failed',
        failureCount: 1,
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('prepares single note downloads as markdown blobs', async () => {
    const download = prepareSingleFileSystemDownload(downloadNoteItem({ name: 'Scene', path: '' }))

    expect(download).toMatchObject({
      status: 'completed',
      fileName: 'Scene.md',
      payload: { kind: 'blob' },
    })
    if (download.status !== 'completed' || download.payload.kind !== 'blob') {
      throw new Error('Expected markdown blob')
    }
    await expect(download.payload.blob.text()).resolves.toBe('')
  })
})

function createDownloadIo(): FileSystemDownloadIo {
  return {
    clearTimeout: clearTimeout,
    fetch: vi.fn((url: string) => Promise.resolve(new Response(new Blob([url]), { status: 200 }))),
    setTimeout: setTimeout,
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

function getArchiveFilePaths(archive: JSZip) {
  return Object.values(archive.files)
    .filter((file) => !file.dir)
    .map((file) => file.name)
}
