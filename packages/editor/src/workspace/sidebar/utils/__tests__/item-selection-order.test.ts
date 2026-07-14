import type { ResourceId } from '../../../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import { SORT_DIRECTIONS, SORT_ORDERS } from '../../../items-persistence-contract'
import type { AnyItem } from '../../../items'
import type { SortOptions } from '../../../items-persistence-contract'
import { createFolder, createNote } from '../../../../test/sidebar-item-factory'
import { buildVisibleSidebarItemIds } from '../item-selection-order'

const alphaSort: SortOptions = {
  order: SORT_ORDERS.Alphabetical,
  direction: SORT_DIRECTIONS.Ascending,
}

function parentMap(items: Array<AnyItem>): Map<ResourceId | null, Array<AnyItem>> {
  const map = new Map<ResourceId | null, Array<AnyItem>>()
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

function getHierarchyFrom(items: Array<AnyItem>) {
  const map = parentMap(items)
  return {
    getChildren: (parentId: ResourceId) => map.get(parentId) ?? [],
    getRoots: () => map.get(null) ?? [],
  }
}

describe('buildVisibleSidebarItemIds', () => {
  it('returns root items and expanded descendants in render order', () => {
    const folder = createFolder({ name: 'Folder' })
    const nestedA = createNote({ name: 'A nested', parentId: folder.id })
    const nestedB = createNote({ name: 'B nested', parentId: folder.id })
    const rootNote = createNote({ name: 'Root note' })

    const result = buildVisibleSidebarItemIds({
      ...getHierarchyFrom([folder, nestedA, nestedB, rootNote]),
      expandedFolderIds: new Set([folder.id]),
      sortOptions: alphaSort,
    })

    expect(result).toEqual([folder.id, nestedA.id, nestedB.id, rootNote.id])
  })

  it('omits descendants of collapsed folders', () => {
    const folder = createFolder({ name: 'Folder' })
    const nested = createNote({ name: 'Nested', parentId: folder.id })
    const rootNote = createNote({ name: 'Root note' })

    const result = buildVisibleSidebarItemIds({
      ...getHierarchyFrom([folder, nested, rootNote]),
      expandedFolderIds: new Set(),
      sortOptions: alphaSort,
    })

    expect(result).toEqual([folder.id, rootNote.id])
  })

  it('deduplicates items that appear in both root and expanded child collections', () => {
    const folder = createFolder({ name: 'Folder' })
    const nested = createNote({ name: 'Nested', parentId: folder.id })
    const duplicateNested = { ...nested }

    const result = buildVisibleSidebarItemIds({
      getRoots: () => [folder, duplicateNested],
      getChildren: (parentId) => (parentId === folder.id ? [nested, duplicateNested] : []),
      expandedFolderIds: new Set([folder.id]),
      sortOptions: alphaSort,
    })

    expect(result).toEqual([folder.id, nested.id])
  })
})
