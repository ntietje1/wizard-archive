import { describe, expect, it } from 'vitest'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'convex/editors/types'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import {
  normalizeTopLevelSelectedItems,
  selectionBelongsToSurface,
} from 'convex/sidebarItems/operations/selection'
import { buildVisibleSidebarItemIds } from '~/features/sidebar/utils/item-selection-order'
import type { SortOptions } from 'convex/editors/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { testId } from '~/test/helpers/test-id'

const alphaSort: SortOptions = {
  order: SORT_ORDERS.Alphabetical,
  direction: SORT_DIRECTIONS.Ascending,
}

function parentMap(items: Array<AnySidebarItem>) {
  const map = new Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>()
  for (const item of items) {
    let siblings = map.get(item.parentId)
    if (!siblings) {
      siblings = []
      map.set(item.parentId, siblings)
    }
    siblings.push(item)
  }
  return map
}

describe('buildVisibleSidebarItemIds', () => {
  it('returns root items and expanded descendants in render order', () => {
    const folder = createFolder({ name: 'Folder' })
    const nestedA = createNote({ name: 'A nested', parentId: folder._id })
    const nestedB = createNote({ name: 'B nested', parentId: folder._id })
    const rootNote = createNote({ name: 'Root note' })

    const result = buildVisibleSidebarItemIds({
      parentItemsMap: parentMap([folder, nestedA, nestedB, rootNote]),
      expandedFolderIds: new Set([folder._id]),
      sortOptions: alphaSort,
    })

    expect(result).toEqual([folder._id, nestedA._id, nestedB._id, rootNote._id])
  })

  it('omits descendants of collapsed folders', () => {
    const folder = createFolder({ name: 'Folder' })
    const nested = createNote({ name: 'Nested', parentId: folder._id })
    const rootNote = createNote({ name: 'Root note' })

    const result = buildVisibleSidebarItemIds({
      parentItemsMap: parentMap([folder, nested, rootNote]),
      expandedFolderIds: new Set(),
      sortOptions: alphaSort,
    })

    expect(result).toEqual([folder._id, rootNote._id])
  })
})

describe('normalizeTopLevelSelectedItems', () => {
  it('removes descendants when their ancestor folder is selected', () => {
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder._id })
    const grandchild = createNote({ name: 'Grandchild', parentId: child._id })
    const sibling = createNote({ name: 'Sibling' })
    const itemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([
      [folder._id, folder],
      [child._id, child],
      [grandchild._id, grandchild],
      [sibling._id, sibling],
    ])

    const result = normalizeTopLevelSelectedItems([child, folder, grandchild, sibling], itemsMap)

    expect(result.map((item) => item._id)).toEqual([folder._id, sibling._id])
  })

  it('preserves explicit order for unrelated selected items', () => {
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    const itemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([
      [first._id, first],
      [second._id, second],
    ])

    const result = normalizeTopLevelSelectedItems([second, first], itemsMap)

    expect(result.map((item) => item._id)).toEqual([second._id, first._id])
  })

  it('deduplicates repeated selected items', () => {
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    const itemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([
      [first._id, first],
      [second._id, second],
    ])

    const result = normalizeTopLevelSelectedItems([first, second, first], itemsMap)

    expect(result.map((item) => item._id)).toEqual([first._id, second._id])
  })

  it('deduplicates repeated selected items even when ancestor data has a cycle', () => {
    const first = createNote({ name: 'First' })
    const baseParentA = createFolder({ name: 'Parent A' })
    const parentB = createFolder({ name: 'Parent B', parentId: baseParentA._id })
    const parentA = { ...baseParentA, parentId: parentB._id }
    const cycledFirst = { ...first, parentId: parentA._id }
    const itemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([
      [cycledFirst._id, cycledFirst],
      [parentA._id, parentA],
      [parentB._id, parentB],
    ])

    const result = normalizeTopLevelSelectedItems([cycledFirst, cycledFirst], itemsMap)

    expect(result.map((item) => item._id)).toEqual([first._id])
  })
})

describe('selectionBelongsToSurface', () => {
  it('requires every selected item to be visible on the current surface', () => {
    const a = testId<'sidebarItems'>('item_a')
    const b = testId<'sidebarItems'>('item_b')
    const hidden = testId<'sidebarItems'>('item_hidden')

    expect(selectionBelongsToSurface([a, b], [a, b])).toBe(true)
    expect(selectionBelongsToSurface([a, hidden], [a, b])).toBe(false)
  })
})
