import { describe, expect, it } from 'vitest'
import {
  buildSidebarItemMaps,
  collectDescendantIds,
} from '~/features/sidebar/utils/sidebar-item-maps'
import { createFile, createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

describe('buildSidebarItemMaps', () => {
  it('builds itemsMap from flat list', () => {
    const note = createNote()
    const folder = createFolder()
    const { itemsMap } = buildSidebarItemMaps([note, folder])
    expect(itemsMap.get(note._id)).toBe(note)
    expect(itemsMap.get(folder._id)).toBe(folder)
    expect(itemsMap.size).toBe(2)
  })

  it('groups items by parentId in parentItemsMap', () => {
    const folder = createFolder({
      _id: testId<'sidebarItems'>('folder_m1'),
      parentId: null,
    })
    const child1 = createNote({ parentId: folder._id })
    const child2 = createNote({ parentId: folder._id })
    const rootNote = createNote({ parentId: null })
    const { parentItemsMap } = buildSidebarItemMaps([folder, child1, child2, rootNote])
    expect(parentItemsMap.get(folder._id)?.length).toBe(2)
    expect(parentItemsMap.get(null)?.length).toBe(2)
  })

  it('reparents orphaned items to root', () => {
    const note = createNote({
      parentId: testId<'sidebarItems'>('folder_nonexistent'),
    })
    const { parentItemsMap } = buildSidebarItemMaps([note])
    expect(parentItemsMap.get(null)).toContain(note)
  })

  it('getAncestorSidebarItems returns ancestor folders', () => {
    const gp = createFolder({
      _id: testId<'sidebarItems'>('folder_a_gp'),
      name: 'GP',
      parentId: null,
    })
    const parent = createFolder({
      _id: testId<'sidebarItems'>('folder_a_p'),
      name: 'Parent',
      parentId: gp._id,
    })
    const note = createNote({ parentId: parent._id })
    const { getAncestorSidebarItems } = buildSidebarItemMaps([gp, parent, note])
    const ancestors = getAncestorSidebarItems(note._id)
    expect(ancestors.map((a) => a.name)).toEqual(['Parent', 'GP'])
  })

  it('getAncestorSidebarItems returns empty for root items', () => {
    const note = createNote({ parentId: null })
    const { getAncestorSidebarItems } = buildSidebarItemMaps([note])
    expect(getAncestorSidebarItems(note._id)).toEqual([])
  })

  it('returns empty for item not in map', () => {
    const { getAncestorSidebarItems } = buildSidebarItemMaps([])
    expect(getAncestorSidebarItems(testId<'sidebarItems'>('nonexistent'))).toEqual([])
  })

  it('handles empty items array', () => {
    const { itemsMap, parentItemsMap } = buildSidebarItemMaps([])
    expect(itemsMap.size).toBe(0)
    expect(parentItemsMap.size).toBe(0)
  })
})

describe('collectDescendantIds', () => {
  it('collects all descendants of a folder', () => {
    const folder = createFolder({
      _id: testId<'sidebarItems'>('folder_d1'),
      parentId: null,
    })
    const child1 = createNote({
      _id: testId<'sidebarItems'>('note_d1'),
      parentId: folder._id,
    })
    const child2 = createFile({
      _id: testId<'sidebarItems'>('file_d1'),
      parentId: folder._id,
    })
    const result = collectDescendantIds(folder._id, [folder, child1, child2])
    expect(result.size).toBe(2)
    expect(result.has(child1._id)).toBe(true)
    expect(result.has(child2._id)).toBe(true)
  })

  it('collects nested descendants recursively', () => {
    const root = createFolder({
      _id: testId<'sidebarItems'>('folder_r'),
      parentId: null,
    })
    const subFolder = createFolder({
      _id: testId<'sidebarItems'>('folder_sub'),
      parentId: root._id,
    })
    const deepNote = createNote({
      _id: testId<'sidebarItems'>('note_deep'),
      parentId: subFolder._id,
    })
    const result = collectDescendantIds(root._id, [root, subFolder, deepNote])
    expect(result.size).toBe(2)
    expect(result.has(subFolder._id)).toBe(true)
    expect(result.has(deepNote._id)).toBe(true)
  })

  it('returns empty set for folder with no children', () => {
    const folder = createFolder({
      _id: testId<'sidebarItems'>('folder_empty'),
      parentId: null,
    })
    const result = collectDescendantIds(folder._id, [folder])
    expect(result.size).toBe(0)
  })

  it('returns empty set for non-existent folder', () => {
    const result = collectDescendantIds(testId<'sidebarItems'>('folder_nonexistent'), [])
    expect(result.size).toBe(0)
  })
})
