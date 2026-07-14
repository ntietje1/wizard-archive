import { describe, expect, it } from 'vite-plus/test'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '../../../test/sidebar-item-factory'
import { testResourceId } from '../../../../../../shared/test/resource-id'
import {
  emptyTrashDescription,
  permanentDeleteDescription,
  permanentDeleteItemsDescription,
} from '../descriptions'

describe('permanentDeleteDescription', () => {
  it('describes permanent deletion for any non-folder item', () => {
    const note = createNote({ name: 'My Note' })
    const file = createFile({ name: 'photo.png' })
    const map = createGameMap({ name: 'Dungeon Map' })

    expect(permanentDeleteDescription(note, [note])).toBe(
      'Are you sure you want to permanently delete "My Note"? This action cannot be undone.',
    )
    expect(permanentDeleteDescription(file, [file])).toBe(
      'Are you sure you want to permanently delete "photo.png"? This action cannot be undone.',
    )
    expect(permanentDeleteDescription(map, [map])).toBe(
      'Are you sure you want to permanently delete "Dungeon Map"? This action cannot be undone.',
    )
  })

  it('includes descendant count for folders with trashed children', () => {
    const folder = createFolder({
      id: testResourceId('folder_t1'),
      name: 'My Folder',
    })
    const child1 = createNote({ parentId: folder.id })
    const child2 = createNote({ parentId: folder.id })

    expect(permanentDeleteDescription(folder, [folder, child1, child2])).toBe(
      'Are you sure you want to permanently delete "My Folder"? This will also delete 2 items inside it. This action cannot be undone.',
    )
  })

  it('uses singular descendant copy', () => {
    const folder = createFolder({
      id: testResourceId('folder_t2'),
      name: 'My Folder',
    })
    const child = createNote({ parentId: folder.id })

    expect(permanentDeleteDescription(folder, [folder, child])).toBe(
      'Are you sure you want to permanently delete "My Folder"? This will also delete 1 item inside it. This action cannot be undone.',
    )
  })
})

describe('permanentDeleteItemsDescription', () => {
  it('describes extra descendant deletion for selected folders', () => {
    const folder = createFolder({
      id: testResourceId('folder_t3'),
      name: 'My Folder',
    })
    const child = createNote({ parentId: folder.id })
    const note = createNote({ name: 'Loose Note' })

    expect(permanentDeleteItemsDescription([folder, note], [folder, child, note])).toBe(
      'This will permanently delete 2 selected items and 1 item inside selected folders. This action cannot be undone.',
    )
  })

  it('does not double count descendants that are already selected', () => {
    const folder = createFolder({
      id: testResourceId('folder_t4'),
      name: 'My Folder',
    })
    const child = createNote({ parentId: folder.id })

    expect(permanentDeleteItemsDescription([folder, child], [folder, child])).toBe(
      'This will permanently delete 2 selected items and cannot be undone.',
    )
  })
})

describe('emptyTrashDescription', () => {
  it('describes empty trash for zero, singular, and plural counts', () => {
    expect(emptyTrashDescription(0)).toBe(
      'Are you sure you want to permanently delete all 0 items in the trash? This action cannot be undone.',
    )
    expect(emptyTrashDescription(1)).toBe(
      'Are you sure you want to permanently delete 1 item in the trash? This action cannot be undone.',
    )
    expect(emptyTrashDescription(5)).toBe(
      'Are you sure you want to permanently delete all 5 items in the trash? This action cannot be undone.',
    )
  })
})
