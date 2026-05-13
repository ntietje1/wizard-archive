import { describe, expect, it } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { resolveNormalizedDraggedSidebarItems } from '~/features/dnd/utils/sidebar-drag-items'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'

function itemMap(items: Array<AnySidebarItem>) {
  return new Map<Id<'sidebarItems'>, AnySidebarItem>(items.map((item) => [item._id, item]))
}

describe('resolveNormalizedDraggedSidebarItems', () => {
  it('collapses dragged descendants under selected ancestor roots', () => {
    const folder = createFolder()
    const child = createNote({ parentId: folder._id })

    const items = resolveNormalizedDraggedSidebarItems({
      sourceData: { sidebarItemIds: [folder._id, child._id] },
      activeItemsMap: itemMap([folder, child]),
    })

    expect(items).toEqual([folder])
  })

  it('keeps multiple independent root items unchanged', () => {
    const note = createNote()
    const secondNote = createNote()
    const folder = createFolder()

    const items = resolveNormalizedDraggedSidebarItems({
      sourceData: { sidebarItemIds: [note._id, secondNote._id, folder._id] },
      activeItemsMap: itemMap([note, secondNote, folder]),
    })

    expect(items).toEqual([note, secondNote, folder])
  })

  it('skips trashed items unless requested', () => {
    const active = createNote()
    const trashed = createNote({ status: 'trashed' })

    const items = resolveNormalizedDraggedSidebarItems({
      sourceData: { sidebarItemIds: [active._id, trashed._id] },
      activeItemsMap: itemMap([active]),
      trashedItemsMap: itemMap([trashed]),
    })

    expect(items).toEqual([active])
  })

  it('can include trashed items for move and restore decisions', () => {
    const trashed = createNote({ status: 'trashed' })

    const items = resolveNormalizedDraggedSidebarItems({
      sourceData: { sidebarItemIds: [trashed._id] },
      activeItemsMap: itemMap([]),
      trashedItemsMap: itemMap([trashed]),
      includeTrashed: true,
    })

    expect(items).toEqual([trashed])
  })

  it('excludes target-specific ids before normalization', () => {
    const folder = createFolder()
    const child = createNote({ parentId: folder._id })

    const items = resolveNormalizedDraggedSidebarItems({
      sourceData: { sidebarItemIds: [folder._id, child._id] },
      activeItemsMap: itemMap([folder, child]),
      excludeItemIds: [folder._id],
    })

    expect(items).toEqual([child])
  })

  it('returns an empty result when every dragged id is excluded', () => {
    const folder = createFolder()
    const child = createNote({ parentId: folder._id })

    const items = resolveNormalizedDraggedSidebarItems({
      sourceData: { sidebarItemIds: [folder._id, child._id] },
      activeItemsMap: itemMap([folder, child]),
      excludeItemIds: [folder._id, child._id],
    })

    expect(items).toEqual([])
  })

  it('normalizes multiple nesting levels after exclusions', () => {
    const grandparent = createFolder({ name: 'Grandparent' })
    const parent = createFolder({ name: 'Parent', parentId: grandparent._id })
    const child = createNote({ name: 'Child', parentId: parent._id })

    const items = resolveNormalizedDraggedSidebarItems({
      sourceData: { sidebarItemIds: [grandparent._id, parent._id, child._id] },
      activeItemsMap: itemMap([grandparent, parent, child]),
      excludeItemIds: [grandparent._id],
    })

    expect(items).toEqual([parent])
  })

  it('returns an empty result when drag source ids are empty', () => {
    const note = createNote()

    expect(
      resolveNormalizedDraggedSidebarItems({
        sourceData: { sidebarItemIds: [] },
        activeItemsMap: itemMap([note]),
      }),
    ).toEqual([])
  })

  it('ignores missing ids that are excluded before resolving items', () => {
    const note = createNote()
    const missing = 'missing-item' as Id<'sidebarItems'>

    expect(
      resolveNormalizedDraggedSidebarItems({
        sourceData: { sidebarItemIds: [missing, note._id] },
        activeItemsMap: itemMap([note]),
        excludeItemIds: [missing],
      }),
    ).toEqual([note])
  })
})
