import { describe, expect, it } from 'vitest'
import {
  resolveParsedItemPath,
  getMinDisambiguationPath,
  parseResolvableWikiItemPath,
} from '../../../shared/links/resolution'
import type { AnyItem } from '@wizard-archive/editor/resources/items'
import type { Id } from '../../_generated/dataModel'
import { assertConvexResourceTitle } from '../../sidebarItems/validation/name'
import { assertConvexSidebarItemSlug } from '../../sidebarItems/validation/slug'

function makeItem(id: string, name: string, parentId: string | null = null): AnyItem {
  const rawSlug = name.toLowerCase().replace(/\s+/g, '-')
  const slug = rawSlug.length >= 3 ? rawSlug : rawSlug.padEnd(3, '0')

  return {
    id: id as Id<'sidebarItems'>,
    _id: id as Id<'sidebarItems'>,
    _creationTime: 0,
    name: name ? assertConvexResourceTitle(name) : ('' as AnyItem['name']),
    slug: name ? assertConvexSidebarItemSlug(slug) : ('invalid' as AnyItem['slug']),
    parentId: parentId as Id<'sidebarItems'> | null,
    campaignId: 'campaign1' as Id<'campaigns'>,
    type: 'notes',
    color: null,
    iconName: null,
    status: 'active',
    myPermissionLevel: 'edit',
    isBookmarked: false,
    inheritShares: true,
    allPermissionLevel: 'none',
    updatedTime: 0,
    updatedBy: 'user1' as Id<'userProfiles'>,
    createdBy: 'user1' as Id<'userProfiles'>,
    deletionTime: null,
    deletedBy: null,
  } as unknown as AnyItem
}

function buildMap(items: Array<AnyItem>) {
  return new Map(items.map((i) => [i.id, i]))
}

function sidebarId(id: string): Id<'sidebarItems'> {
  return id as Id<'sidebarItems'>
}

function resolveGlobalItemByPath(
  pathSegments: Array<string>,
  items: Array<AnyItem>,
  itemsMap: Map<Id<'sidebarItems'>, AnyItem>,
) {
  return resolveParsedItemPath('global', pathSegments, items, itemsMap)
}

describe('resolveParsedItemPath global resolution', () => {
  const items = [
    makeItem('a', 'Factions'),
    makeItem('b', 'The Guild', 'a'),
    makeItem('c', 'Characters'),
    makeItem('d', 'Design', 'a'),
    makeItem('e', 'Design', 'c'),
  ]
  const map = buildMap(items)

  it('resolves by name alone', () => {
    expect(resolveGlobalItemByPath(['The Guild'], items, map)?.id).toBe('b')
  })

  it('resolves by full path', () => {
    expect(resolveGlobalItemByPath(['Factions', 'The Guild'], items, map)?.id).toBe('b')
  })

  it('returns undefined for non-existent path', () => {
    expect(resolveGlobalItemByPath(['Nonexistent'], items, map)).toBeUndefined()
  })

  it('is case-insensitive', () => {
    expect(resolveGlobalItemByPath(['the guild'], items, map)?.id).toBe('b')
  })

  it('ignores surrounding whitespace in path segments', () => {
    expect(resolveGlobalItemByPath(['  factions  ', '  the guild  '], items, map)?.id).toBe('b')
  })

  it('prefers the alphabetically earlier full path for ambiguous names', () => {
    const result = resolveGlobalItemByPath(['Design'], items, map)
    expect(result?.id).toBe('e')
  })

  it('prefers the item highest in the sidebar hierarchy for ambiguous paths', () => {
    const nestedItems = [
      makeItem('a', 'World'),
      makeItem('b', 'Places', 'a'),
      makeItem('c', 'Tavern'),
      makeItem('d', 'Tavern', 'b'),
    ]
    const nestedMap = buildMap(nestedItems)

    expect(resolveGlobalItemByPath(['Tavern'], nestedItems, nestedMap)?.id).toBe('c')
  })

  it('breaks ties alphabetically by full path', () => {
    const tiedItems = [
      makeItem('a', 'Beta'),
      makeItem('b', 'Guild', 'a'),
      makeItem('c', 'Alpha'),
      makeItem('d', 'Guild', 'c'),
    ]
    const tiedMap = buildMap(tiedItems)

    expect(resolveGlobalItemByPath(['Guild'], tiedItems, tiedMap)?.id).toBe('d')
  })

  it('does not match collapsed paths through unnamed ancestors', () => {
    const unnamedAncestorItems = [
      makeItem('a', 'A'),
      makeItem('b', '', 'a'),
      makeItem('c', 'C', 'b'),
      makeItem('d', 'C', 'a'),
    ]
    const unnamedAncestorMap = buildMap(unnamedAncestorItems)

    expect(resolveGlobalItemByPath(['A', 'C'], unnamedAncestorItems, unnamedAncestorMap)?.id).toBe(
      'd',
    )
  })
})

describe('resolveParsedItemPath', () => {
  const items = [
    makeItem('world', 'World'),
    makeItem('regions', 'Regions', 'world'),
    makeItem('north', 'North', 'regions'),
    makeItem('atlas', 'Atlas', 'north'),
  ]
  const map = buildMap(items)

  it('uses global resolution for bare paths', () => {
    expect(resolveParsedItemPath('global', ['Atlas'], items, map)?.id).toBe('atlas')
  })

  it('uses relative resolution when requested', () => {
    expect(
      resolveParsedItemPath('relative', ['..', 'North', 'Atlas'], items, map, sidebarId('north'))
        ?.id,
    ).toBe('atlas')
  })
})

describe('parseResolvableWikiItemPath', () => {
  it('accepts plain item paths and rejects display names, headings, and empty paths', () => {
    expect(parseResolvableWikiItemPath('World/Atlas')).toMatchObject({
      pathKind: 'global',
      itemPath: ['World', 'Atlas'],
    })
    expect(parseResolvableWikiItemPath('World/Atlas|Atlas')).toBeNull()
    expect(parseResolvableWikiItemPath('World/Atlas#Intro')).toBeNull()
    expect(parseResolvableWikiItemPath('')).toBeNull()
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
    const invalidPathItems = [
      makeItem('a', 'Root'),
      makeItem('b', '', 'a'),
      makeItem('c', 'Leaf', 'b'),
    ]
    const invalidPathMap = buildMap(invalidPathItems)

    expect(getMinDisambiguationPath(invalidPathItems[2], invalidPathItems, invalidPathMap)).toEqual(
      ['Leaf'],
    )
  })

  it('falls back to the item name even when the invalid-path fallback is ambiguous', () => {
    const invalidPathItems = [
      makeItem('a', 'Root'),
      makeItem('b', '', 'a'),
      makeItem('c', 'Leaf', 'b'),
      makeItem('d', 'Leaf'),
    ]
    const invalidPathMap = buildMap(invalidPathItems)

    expect(getMinDisambiguationPath(invalidPathItems[2], invalidPathItems, invalidPathMap)).toEqual(
      ['Leaf'],
    )
  })
})
