import { describe, expect, it } from 'vitest'
import { getDropResultStats } from '~/features/file-upload/utils/folder-reader'
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
