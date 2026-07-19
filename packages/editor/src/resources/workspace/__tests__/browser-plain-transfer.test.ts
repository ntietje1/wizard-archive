import { describe, expect, it } from 'vite-plus/test'
import { readBrowserPlainTransfer } from '../browser-plain-transfer'

describe('browser plain transfer sources', () => {
  it('falls back to ordinary files when filesystem entries are unavailable', async () => {
    const first = new File(['first'], 'First.txt')
    const second = new File(['second'], 'Second.bin')

    await expect(readBrowserPlainTransfer(dataTransfer([], [first, second]))).resolves.toEqual({
      sources: [
        { id: 'browser-1', kind: 'file', name: 'First.txt' },
        { id: 'browser-2', kind: 'file', name: 'Second.bin' },
      ],
      entries: [
        {
          sourceId: 'browser-1',
          path: 'First.txt',
          type: 'file',
          bytes: new Uint8Array([102, 105, 114, 115, 116]),
        },
        {
          sourceId: 'browser-2',
          path: 'Second.bin',
          type: 'file',
          bytes: new Uint8Array([115, 101, 99, 111, 110, 100]),
        },
      ],
    })
  })

  it('drains every directory batch and preserves empty and nested folders', async () => {
    const nested = directoryEntry('nested', [[fileEntry('Note.md', '# Note')], []])
    const empty = directoryEntry('empty', [[]])
    const root = directoryEntry('Campaign', [[fileEntry('Map.png', 'image')], [nested, empty], []])

    const transfer = await readBrowserPlainTransfer(
      dataTransfer([dataTransferItem(new File([], 'ignored'), root)]),
    )

    expect(transfer.sources).toEqual([{ id: 'browser-1', kind: 'directory', name: 'Campaign' }])
    expect(
      transfer.entries.map((entry) => ({
        sourceId: entry.sourceId,
        path: entry.path,
        type: entry.type,
      })),
    ).toEqual([
      { sourceId: 'browser-1', path: 'Map.png', type: 'file' },
      { sourceId: 'browser-1', path: 'nested', type: 'directory' },
      { sourceId: 'browser-1', path: 'nested/Note.md', type: 'file' },
      { sourceId: 'browser-1', path: 'empty', type: 'directory' },
    ])
  })

  it('retains an empty top-level directory as a source without browser-only entries', async () => {
    const root = directoryEntry('Empty', [[]])

    await expect(
      readBrowserPlainTransfer(dataTransfer([dataTransferItem(new File([], 'ignored'), root)])),
    ).resolves.toEqual({
      sources: [{ id: 'browser-1', kind: 'directory', name: 'Empty' }],
      entries: [],
    })
  })

  it('snapshots live transfer items before reading any entry', async () => {
    const items: Array<DataTransferItem> = []
    const first = fileEntry('First.txt', 'first', () => {
      items.length = 1
    })
    const second = fileEntry('Second.txt', 'second')
    items.push(
      dataTransferItem(new File([], 'ignored'), first),
      dataTransferItem(new File([], 'ignored'), second),
    )

    const transfer = await readBrowserPlainTransfer(dataTransfer(items))

    expect(transfer.entries.map((entry) => entry.path)).toEqual(['First.txt', 'Second.txt'])
  })

  it('surfaces unreadable browser entries without constructing a partial transfer', async () => {
    const unreadable = fileEntry('Unreadable.txt', 'content', undefined, true)

    await expect(
      readBrowserPlainTransfer(
        dataTransfer([dataTransferItem(new File([], 'ignored'), unreadable)]),
      ),
    ).rejects.toThrow('Cannot read file')
  })
})

function dataTransfer(
  items: ReadonlyArray<DataTransferItem>,
  files: ReadonlyArray<File> = [],
): Parameters<typeof readBrowserPlainTransfer>[0] {
  return { files, items }
}

function dataTransferItem(file: File, entry: FileSystemEntry): DataTransferItem {
  return {
    kind: 'file',
    type: file.type,
    getAsFile: () => file,
    getAsString: () => {},
    webkitGetAsEntry: () => entry,
  } as DataTransferItem
}

function fileEntry(
  name: string,
  content: string,
  onRead?: () => void,
  reject = false,
): FileSystemFileEntry {
  return {
    filesystem: {} as FileSystem,
    fullPath: `/${name}`,
    isDirectory: false,
    isFile: true,
    name,
    file: (resolve, rejectFile) => {
      onRead?.()
      if (reject) {
        rejectFile?.(new DOMException('Cannot read file'))
        return
      }
      resolve(new File([content], name))
    },
    getParent: () => {},
  } as FileSystemFileEntry
}

function directoryEntry(
  name: string,
  batches: ReadonlyArray<ReadonlyArray<FileSystemEntry>>,
): FileSystemDirectoryEntry {
  let index = 0
  return {
    filesystem: {} as FileSystem,
    fullPath: `/${name}`,
    isDirectory: true,
    isFile: false,
    name,
    createReader: () =>
      ({
        readEntries: (resolve) => {
          resolve([...(batches[index] ?? [])])
          index += 1
        },
      }) as FileSystemDirectoryReader,
    getDirectory: () => {},
    getFile: () => {},
    getParent: () => {},
  } as FileSystemDirectoryEntry
}
