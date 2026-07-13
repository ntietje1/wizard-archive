import { describe, expect, it } from 'vite-plus/test'
import { getDropResultStats, processDataTransferItems } from '../file-drop'
import type { DropResult } from '../file-drop'

type TestFolderStructure = DropResult['rootFolders'][number]

function makeFile(name: string): { file: File; relativePath: string } {
  return {
    file: new File([''], name),
    relativePath: name,
  }
}

function makeDataTransferFileItem(
  file: File,
  webkitGetAsEntry?: () => FileSystemEntry | null,
): DataTransferItem {
  const item: Partial<DataTransferItem> = {
    kind: 'file',
    type: file.type,
    getAsFile: () => file,
    getAsString: () => {},
  }

  if (webkitGetAsEntry) {
    item.webkitGetAsEntry = webkitGetAsEntry
  }

  return item as DataTransferItem
}

function makeFileEntry(
  name: string,
  file: File,
  options: { onRead?: () => void; reject?: boolean } = {},
): FileSystemFileEntry {
  return {
    filesystem: {} as FileSystem,
    fullPath: `/${name}`,
    isDirectory: false,
    isFile: true,
    name,
    file: (successCallback, errorCallback) => {
      options.onRead?.()
      if (options.reject) {
        errorCallback?.(new DOMException('Cannot read file'))
        return
      }
      successCallback(file)
    },
    getParent: () => {},
  } as FileSystemFileEntry
}

function makeDirectoryEntry(
  name: string,
  batches: Array<Array<FileSystemEntry>>,
  options: { rejectReads?: boolean } = {},
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
        readEntries: (successCallback, errorCallback) => {
          if (options.rejectReads) {
            errorCallback?.(new DOMException('Cannot read directory'))
            return
          }
          successCallback(batches[index] ?? [])
          index += 1
        },
      }) as FileSystemDirectoryReader,
    getDirectory: () => {},
    getFile: () => {},
    getParent: () => {},
  } as FileSystemDirectoryEntry
}

function makeFolder(
  name: string,
  files: Array<string> = [],
  subfolders: Array<TestFolderStructure> = [],
): TestFolderStructure {
  return {
    name,
    relativePath: name,
    files: files.map((f) => ({
      file: new File([''], f),
      relativePath: `${name}/${f}`,
    })),
    subfolders,
  }
}

describe('getDropResultStats', () => {
  it('counts only root files when there are no folders', () => {
    const result: DropResult = {
      files: [makeFile('a.txt'), makeFile('b.txt')],
      rootFolders: [],
    }
    const stats = getDropResultStats(result)
    expect(stats.totalFiles).toBe(2)
    expect(stats.totalFolders).toBe(0)
  })

  it('combines root files + folder files', () => {
    const folder = makeFolder('docs', ['readme.md', 'notes.txt'])
    const result: DropResult = {
      files: [makeFile('loose.txt')],
      rootFolders: [folder],
    }
    const stats = getDropResultStats(result)
    expect(stats.totalFiles).toBe(3)
    expect(stats.totalFolders).toBe(1)
  })

  it('counts files and folders across multiple root folders', () => {
    const sub = makeFolder('sub', ['deep.txt'])
    const folder1 = makeFolder('f1', ['a.txt'], [sub])
    const folder2 = makeFolder('f2', ['b.txt', 'c.txt'])
    const result: DropResult = {
      files: [],
      rootFolders: [folder1, folder2],
    }
    const stats = getDropResultStats(result)
    expect(stats.totalFiles).toBe(4)
    expect(stats.totalFolders).toBe(3)
  })

  it('returns zeros for empty drop result', () => {
    const result: DropResult = {
      files: [],
      rootFolders: [],
    }
    const stats = getDropResultStats(result)
    expect(stats.totalFiles).toBe(0)
    expect(stats.totalFolders).toBe(0)
  })
})

describe('processDataTransferItems', () => {
  it('keeps plain files when no filesystem entry is available', async () => {
    const missingEntryFile = new File(['missing'], 'missing-entry.txt', { type: 'text/plain' })
    const nullEntryFile = new File(['null'], 'null-entry.txt', { type: 'text/plain' })

    const result = await processDataTransferItems([
      makeDataTransferFileItem(missingEntryFile),
      makeDataTransferFileItem(nullEntryFile, () => null),
    ])

    expect(result).toEqual({
      files: [
        { file: missingEntryFile, relativePath: 'missing-entry.txt' },
        { file: nullEntryFile, relativePath: 'null-entry.txt' },
      ],
      rootFolders: [],
    })
  })

  it('uses filesystem file entries when browser drop data provides them', async () => {
    const file = new File(['entry'], 'entry-file.txt', { type: 'text/plain' })
    const entry = makeFileEntry('renamed-by-entry.txt', file)

    const result = await processDataTransferItems([makeDataTransferFileItem(file, () => entry)])

    expect(result).toEqual({
      files: [{ file, relativePath: 'renamed-by-entry.txt' }],
      rootFolders: [],
    })
  })

  it('preserves nested folder paths from filesystem directory entries', async () => {
    const rootFile = new File(['root'], 'root.txt', { type: 'text/plain' })
    const childFile = new File(['child'], 'child.txt', { type: 'text/plain' })
    const child = makeDirectoryEntry('child', [[makeFileEntry('child.txt', childFile)], []])
    const root = makeDirectoryEntry('docs', [[makeFileEntry('root.txt', rootFile), child], []])

    const result = await processDataTransferItems([
      makeDataTransferFileItem(new File([], 'ignored'), () => root),
    ])

    expect(result).toEqual({
      files: [],
      rootFolders: [
        {
          name: 'docs',
          relativePath: 'docs',
          files: [{ file: rootFile, relativePath: 'docs/root.txt' }],
          subfolders: [
            {
              name: 'child',
              relativePath: 'docs/child',
              files: [{ file: childFile, relativePath: 'docs/child/child.txt' }],
              subfolders: [],
            },
          ],
        },
      ],
    })
  })

  it('reads every non-empty directory entry batch before the terminator batch', async () => {
    const firstFile = new File(['first'], 'first.txt', { type: 'text/plain' })
    const secondFile = new File(['second'], 'second.txt', { type: 'text/plain' })
    const root = makeDirectoryEntry('docs', [
      [makeFileEntry('first.txt', firstFile)],
      [makeFileEntry('second.txt', secondFile)],
      [],
    ])

    const result = await processDataTransferItems([
      makeDataTransferFileItem(new File([], 'ignored'), () => root),
    ])

    expect(result.rootFolders[0]?.files).toEqual([
      { file: firstFile, relativePath: 'docs/first.txt' },
      { file: secondFile, relativePath: 'docs/second.txt' },
    ])
  })

  it('snapshots live transfer items before awaiting filesystem entries', async () => {
    const firstFile = new File(['first'], 'first.txt', { type: 'text/plain' })
    const secondFile = new File(['second'], 'second.txt', { type: 'text/plain' })
    const liveItems = [
      makeDataTransferFileItem(firstFile, () =>
        makeFileEntry('first.txt', firstFile, {
          onRead: () => {
            liveItems.length = 1
          },
        }),
      ),
      makeDataTransferFileItem(secondFile, () => makeFileEntry('second.txt', secondFile)),
    ]
    const liveItemList = {
      [Symbol.iterator]: function* () {
        let index = 0
        while (index < liveItems.length) {
          yield liveItems[index]!
          index += 1
        }
      },
    } as unknown as DataTransferItemList

    const result = await processDataTransferItems(liveItemList)

    expect(result.files).toEqual([
      { file: firstFile, relativePath: 'first.txt' },
      { file: secondFile, relativePath: 'second.txt' },
    ])
  })

  it('surfaces unreadable filesystem entries', async () => {
    const goodFile = new File(['good'], 'good.txt', { type: 'text/plain' })
    const badFile = new File(['bad'], 'bad.txt', { type: 'text/plain' })
    const unreadableFolder = makeDirectoryEntry('unreadable', [], { rejectReads: true })

    await expect(
      processDataTransferItems([
        makeDataTransferFileItem(badFile, () =>
          makeFileEntry('bad.txt', badFile, { reject: true }),
        ),
        makeDataTransferFileItem(new File([], 'ignored'), () => unreadableFolder),
        makeDataTransferFileItem(goodFile, () => makeFileEntry('good.txt', goodFile)),
      ]),
    ).rejects.toThrow('Cannot read file')
  })
})
