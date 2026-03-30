import { describe, expect, it } from 'vitest'
import {
  emptyTrashDescription,
  permanentDeleteDescription,
} from '~/features/sidebar/utils/trash-utils'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

describe('permanentDeleteDescription', () => {
  it('returns exact message for non-folder item', () => {
    const note = createNote({ name: 'My Note' })
    expect(permanentDeleteDescription(note, [note])).toBe(
      'Are you sure you want to permanently delete "My Note"? This action cannot be undone.',
    )
  })

  it('includes descendant count for folder with children', () => {
    const folder = createFolder({
      _id: testId<'folders'>('folder_t1'),
      name: 'My Folder',
    })
    const child1 = createNote({ parentId: folder._id })
    const child2 = createNote({ parentId: folder._id })
    expect(permanentDeleteDescription(folder, [folder, child1, child2])).toBe(
      'Are you sure you want to permanently delete "My Folder"? This will also delete 2 items inside it. This action cannot be undone.',
    )
  })

  it('uses singular "item" for single descendant', () => {
    const folder = createFolder({
      _id: testId<'folders'>('folder_t2'),
      name: 'My Folder',
    })
    const child = createNote({ parentId: folder._id })
    expect(permanentDeleteDescription(folder, [folder, child])).toBe(
      'Are you sure you want to permanently delete "My Folder"? This will also delete 1 item inside it. This action cannot be undone.',
    )
  })

  it('omits descendant detail for empty folder', () => {
    const folder = createFolder({ name: 'Empty Folder' })
    expect(permanentDeleteDescription(folder, [folder])).toBe(
      'Are you sure you want to permanently delete "Empty Folder"? This action cannot be undone.',
    )
  })

  it('works for file type (non-folder, no descendants)', () => {
    const file = createFile({ name: 'photo.png' })
    expect(permanentDeleteDescription(file, [file])).toBe(
      'Are you sure you want to permanently delete "photo.png"? This action cannot be undone.',
    )
  })

  it('works for game map type', () => {
    const map = createGameMap({ name: 'Dungeon Map' })
    expect(permanentDeleteDescription(map, [map])).toBe(
      'Are you sure you want to permanently delete "Dungeon Map"? This action cannot be undone.',
    )
  })
})

describe('emptyTrashDescription', () => {
  it('handles zero items', () => {
    expect(emptyTrashDescription(0)).toBe(
      'Are you sure you want to permanently delete all 0 items in the trash? This action cannot be undone.',
    )
  })

  it('returns exact singular message', () => {
    expect(emptyTrashDescription(1)).toBe(
      'Are you sure you want to permanently delete 1 item in the trash? This action cannot be undone.',
    )
  })

  it('returns plural message for exactly 2 items', () => {
    expect(emptyTrashDescription(2)).toBe(
      'Are you sure you want to permanently delete all 2 items in the trash? This action cannot be undone.',
    )
  })

  it('returns exact plural message', () => {
    expect(emptyTrashDescription(5)).toBe(
      'Are you sure you want to permanently delete all 5 items in the trash? This action cannot be undone.',
    )
  })
})
