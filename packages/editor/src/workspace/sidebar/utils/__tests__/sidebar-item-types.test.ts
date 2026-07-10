import { describe, expect, it } from 'vite-plus/test'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '../../../../test/sidebar-item-factory'
import { isFileItem, isFolderItem, isMapItem, isNoteItem } from '../sidebar-item-types'

describe('sidebar item type guards', () => {
  it('identifies each concrete sidebar item type by its item type', () => {
    const cases = [
      { item: createNote(), guard: isNoteItem },
      { item: createFolder(), guard: isFolderItem },
      { item: createGameMap(), guard: isMapItem },
      { item: createFile(), guard: isFileItem },
    ] as const

    for (const { item, guard } of cases) {
      expect(guard(item)).toBe(true)
    }
  })

  it('rejects non-matching sidebar item types', () => {
    const note = createNote()
    const folder = createFolder()
    const map = createGameMap()
    const file = createFile()

    expect(isNoteItem(folder)).toBe(false)
    expect(isNoteItem(map)).toBe(false)
    expect(isNoteItem(file)).toBe(false)

    expect(isFolderItem(note)).toBe(false)
    expect(isFolderItem(map)).toBe(false)
    expect(isFolderItem(file)).toBe(false)

    expect(isMapItem(note)).toBe(false)
    expect(isMapItem(folder)).toBe(false)
    expect(isMapItem(file)).toBe(false)

    expect(isFileItem(note)).toBe(false)
    expect(isFileItem(folder)).toBe(false)
    expect(isFileItem(map)).toBe(false)
  })

  it('rejects nullish values', () => {
    const guards = [isNoteItem, isFolderItem, isMapItem, isFileItem] as const

    for (const guard of guards) {
      expect(guard(null)).toBe(false)
      expect(guard(undefined)).toBe(false)
    }
  })
})
