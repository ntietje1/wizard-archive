import { describe, expect, it } from 'vitest'
import {
  countFilesInFolderStructure,
  countFoldersInStructure,
  getDropResultStats,
} from '~/features/file-upload/utils/folder-reader'
import type { DropResult, FolderStructure } from '~/features/file-upload/utils/folder-reader'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string): { file: File; relativePath: string } {
  return {
    file: new File([''], name),
    relativePath: name,
  }
}

function makeFolder(
  name: string,
  files: Array<string> = [],
  subfolders: Array<FolderStructure> = [],
): FolderStructure {
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

// ===========================================================================
// countFilesInFolderStructure
// ===========================================================================

describe('countFilesInFolderStructure', () => {
  it('counts files in a flat folder', () => {
    const folder = makeFolder('docs', ['a.txt', 'b.txt', 'c.txt'])
    expect(countFilesInFolderStructure(folder)).toBe(3)
  })

  it('counts files across nested folders', () => {
    const inner = makeFolder('inner', ['deep.txt'])
    const outer = makeFolder('outer', ['top.txt'], [inner])
    expect(countFilesInFolderStructure(outer)).toBe(2)
  })

  it('returns 0 for empty folder', () => {
    const folder = makeFolder('empty')
    expect(countFilesInFolderStructure(folder)).toBe(0)
  })

  it('counts files in deeply nested structure', () => {
    const l3 = makeFolder('l3', ['f3.txt'])
    const l2 = makeFolder('l2', ['f2.txt'], [l3])
    const l1 = makeFolder('l1', ['f1.txt'], [l2])
    expect(countFilesInFolderStructure(l1)).toBe(3)
  })

  it('counts files across multiple sibling subfolders', () => {
    const sub1 = makeFolder('sub1', ['a.txt', 'b.txt'])
    const sub2 = makeFolder('sub2', ['c.txt'])
    const root = makeFolder('root', ['d.txt'], [sub1, sub2])
    expect(countFilesInFolderStructure(root)).toBe(4)
  })
})

// ===========================================================================
// countFoldersInStructure
// ===========================================================================

describe('countFoldersInStructure', () => {
  it('counts self for a folder with no subfolders', () => {
    const folder = makeFolder('single')
    expect(countFoldersInStructure(folder)).toBe(1)
  })

  it('counts self + nested subfolders', () => {
    const inner = makeFolder('inner')
    const outer = makeFolder('outer', [], [inner])
    expect(countFoldersInStructure(outer)).toBe(2)
  })

  it('counts all folders in deep nesting', () => {
    const l3 = makeFolder('l3')
    const l2 = makeFolder('l2', [], [l3])
    const l1 = makeFolder('l1', [], [l2])
    expect(countFoldersInStructure(l1)).toBe(3)
  })

  it('counts multiple sibling subfolders', () => {
    const a = makeFolder('a')
    const b = makeFolder('b')
    const root = makeFolder('root', [], [a, b])
    expect(countFoldersInStructure(root)).toBe(3)
  })
})

// ===========================================================================
// getDropResultStats
// ===========================================================================

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
    // f1 has 1 file + sub has 1 file + f2 has 2 files = 4
    expect(stats.totalFiles).toBe(4)
    // f1 (1) + sub (1) + f2 (1) = 3
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
