import { describe, expect, it } from 'vite-plus/test'
import {
  getItemPath,
  resolveItemByPath,
  resolveAllByPath,
  isPathUnique,
  getMinDisambiguationPath,
} from '../linkResolution'
import type { AnySidebarItem } from '../../sidebarItems/types/types'
import type { Id } from '../../_generated/dataModel'

function makeItem(id: string, name: string, parentId: string | null = null): AnySidebarItem {
  return {
    _id: id as Id<'sidebarItems'>,
    _creationTime: 0,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    parentId: parentId as Id<'sidebarItems'> | null,
    campaignId: 'campaign1' as Id<'campaigns'>,
    type: 'notes',
    color: null,
    iconName: null,
    location: 'sidebar',
    myPermissionLevel: 'edit',
    isBookmarked: false,
    inheritShares: true,
    allPermissionLevel: 'none',
    updatedTime: 0,
    updatedBy: 'user1' as Id<'userProfiles'>,
    createdBy: 'user1' as Id<'userProfiles'>,
    deletionTime: null,
    deletedBy: null,
  } as unknown as AnySidebarItem
}

function buildMap(items: Array<AnySidebarItem>) {
  return new Map(items.map((i) => [i._id, i]))
}

describe('getItemPath', () => {
  it('returns path for root item', () => {
    const item = makeItem('a', 'Root Note')
    const map = buildMap([item])
    expect(getItemPath(item, map)).toEqual(['Root Note'])
  })

  it('returns path for nested item', () => {
    const parent = makeItem('a', 'Folder')
    const child = makeItem('b', 'Note', 'a')
    const map = buildMap([parent, child])
    expect(getItemPath(child, map)).toEqual(['Folder', 'Note'])
  })

  it('handles deep nesting', () => {
    const root = makeItem('a', 'Root')
    const mid = makeItem('b', 'Mid', 'a')
    const leaf = makeItem('c', 'Leaf', 'b')
    const map = buildMap([root, mid, leaf])
    expect(getItemPath(leaf, map)).toEqual(['Root', 'Mid', 'Leaf'])
  })

  it('breaks parent cycles instead of hanging', () => {
    const a = makeItem('a', 'A', 'b')
    const b = makeItem('b', 'B', 'a')
    const map = buildMap([a, b])

    const path = getItemPath(a, map)

    expect(path).toContain('A')
    expect(path.length).toBeLessThanOrEqual(2)
  })

  it('returns an empty path when an ancestor has an empty name', () => {
    const root = makeItem('a', 'Root')
    const unnamed = makeItem('b', '', 'a')
    const leaf = makeItem('c', 'Leaf', 'b')
    const map = buildMap([root, unnamed, leaf])

    expect(getItemPath(leaf, map)).toEqual([])
  })
})

describe('resolveItemByPath', () => {
  const items = [
    makeItem('a', 'Factions'),
    makeItem('b', 'The Guild', 'a'),
    makeItem('c', 'Characters'),
    makeItem('d', 'Design', 'a'),
    makeItem('e', 'Design', 'c'),
  ]
  const map = buildMap(items)

  it('resolves by name alone', () => {
    expect(resolveItemByPath(['The Guild'], items, map)?._id).toBe('b')
  })

  it('resolves by full path', () => {
    expect(resolveItemByPath(['Factions', 'The Guild'], items, map)?._id).toBe('b')
  })

  it('returns undefined for non-existent path', () => {
    expect(resolveItemByPath(['Nonexistent'], items, map)).toBeUndefined()
  })

  it('is case-insensitive', () => {
    expect(resolveItemByPath(['the guild'], items, map)?._id).toBe('b')
  })

  it('prefers the alphabetically earlier full path for ambiguous names', () => {
    const result = resolveItemByPath(['Design'], items, map)
    expect(result?._id).toBe('e')
  })

  it('prefers the item highest in the sidebar hierarchy for ambiguous paths', () => {
    const nestedItems = [
      makeItem('a', 'World'),
      makeItem('b', 'Places', 'a'),
      makeItem('c', 'Tavern'),
      makeItem('d', 'Tavern', 'b'),
    ]
    const nestedMap = buildMap(nestedItems)

    expect(resolveItemByPath(['Tavern'], nestedItems, nestedMap)?._id).toBe('c')
  })

  it('breaks ties alphabetically by full path', () => {
    const tiedItems = [
      makeItem('a', 'Beta'),
      makeItem('b', 'Guild', 'a'),
      makeItem('c', 'Alpha'),
      makeItem('d', 'Guild', 'c'),
    ]
    const tiedMap = buildMap(tiedItems)

    expect(resolveItemByPath(['Guild'], tiedItems, tiedMap)?._id).toBe('d')
  })

  it('does not match collapsed paths through unnamed ancestors', () => {
    const items = [
      makeItem('a', 'A'),
      makeItem('b', '', 'a'),
      makeItem('c', 'C', 'b'),
      makeItem('d', 'C', 'a'),
    ]
    const map = buildMap(items)

    expect(resolveItemByPath(['A', 'C'], items, map)?._id).toBe('d')
  })
})

describe('resolveAllByPath', () => {
  const items = [
    makeItem('a', 'Factions'),
    makeItem('b', 'Design', 'a'),
    makeItem('c', 'Characters'),
    makeItem('d', 'Design', 'c'),
  ]
  const map = buildMap(items)

  it('returns all matches for ambiguous name', () => {
    const matches = resolveAllByPath(['Design'], items, map)
    expect(matches).toHaveLength(2)
    expect(matches.map((item) => item._id)).toEqual(['d', 'b'])
  })

  it('returns single match for unique path', () => {
    const matches = resolveAllByPath(['Factions', 'Design'], items, map)
    expect(matches).toHaveLength(1)
    expect(matches[0]._id).toBe('b')
  })

  it('returns empty for non-existent', () => {
    expect(resolveAllByPath(['Nonexistent'], items, map)).toEqual([])
  })
})

describe('isPathUnique', () => {
  const items = [
    makeItem('a', 'Factions'),
    makeItem('b', 'Design', 'a'),
    makeItem('c', 'Characters'),
    makeItem('d', 'Design', 'c'),
    makeItem('e', 'Unique'),
  ]
  const map = buildMap(items)

  it('returns false for ambiguous path', () => {
    expect(isPathUnique(['Design'], items, map)).toBe(false)
  })

  it('returns true for unique path', () => {
    expect(isPathUnique(['Factions', 'Design'], items, map)).toBe(true)
  })

  it('returns true for unique name', () => {
    expect(isPathUnique(['Unique'], items, map)).toBe(true)
  })

  it('returns false for empty path', () => {
    expect(isPathUnique([], items, map)).toBe(false)
  })
})

describe('getMinDisambiguationPath', () => {
  const items = [
    makeItem('a', 'Factions'),
    makeItem('b', 'Design', 'a'),
    makeItem('c', 'Characters'),
    makeItem('d', 'Design', 'c'),
    makeItem('e', 'Unique'),
  ]
  const map = buildMap(items)

  it('returns name alone for unique item', () => {
    expect(getMinDisambiguationPath(items[4], items, map)).toEqual(['Unique'])
  })

  it('returns partial path for ambiguous name', () => {
    const path = getMinDisambiguationPath(items[1], items, map)
    expect(path).toEqual(['Factions', 'Design'])
  })

  it('returns the full ancestor chain when multiple segments are needed to disambiguate', () => {
    const deepItems = [
      makeItem('a', 'World'),
      makeItem('b', 'Places', 'a'),
      makeItem('c', 'Tavern', 'b'),
      makeItem('d', 'Locations'),
      makeItem('e', 'Places', 'd'),
      makeItem('f', 'Tavern', 'e'),
    ]
    const deepMap = buildMap(deepItems)

    const path = getMinDisambiguationPath(deepItems[2], deepItems, deepMap)
    expect(path).toEqual(['World', 'Places', 'Tavern'])
  })

  it('falls back to the item name when the full path is invalid', () => {
    const items = [
      makeItem('a', 'Root'),
      makeItem('b', '', 'a'),
      makeItem('c', 'Leaf', 'b'),
    ]
    const map = buildMap(items)

    expect(getMinDisambiguationPath(items[2], items, map)).toEqual(['Leaf'])
  })
})
