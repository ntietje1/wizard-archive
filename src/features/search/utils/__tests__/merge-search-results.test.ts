import { describe, expect, it } from 'vitest'
import { mergeSearchResults } from '~/features/search/utils/merge-search-results'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { BlockSearchResult } from 'convex/blocks/functions/searchBlocks'
import type { Id } from 'convex/_generated/dataModel'

function mockItem(id: string, name: string): AnySidebarItem {
  return {
    _id: id as Id<'sidebarItems'>,
    _creationTime: 0,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    parentId: null,
    campaignId: 'campaign-1' as Id<'campaigns'>,
    type: 'note',
    shares: [],
    permissionLevel: 'edit',
    isBookmarked: false,
    allPermissionLevel: null,
    inheritShares: false,
    iconName: null,
    coverImage: null,
    updatedTime: 0,
    updatedBy: 'user-1' as Id<'userProfiles'>,
    createdBy: 'user-1' as Id<'userProfiles'>,
    deletionTime: null,
    deletedBy: null,
    location: 'sidebar',
  } as unknown as AnySidebarItem
}

function mockBlock(noteId: string, plainText: string): BlockSearchResult {
  return {
    blockNoteId: `block-${noteId}`,
    noteId: noteId as Id<'sidebarItems'>,
    plainText,
    type: 'paragraph',
  } as BlockSearchResult
}

function buildItemsMap(items: Array<AnySidebarItem>) {
  const map = new Map<Id<'sidebarItems'>, AnySidebarItem>()
  for (const item of items) {
    map.set(item._id, item)
  }
  return map
}

describe('mergeSearchResults', () => {
  it('returns empty array when all inputs are empty', () => {
    expect(mergeSearchResults([], undefined, new Map(), 'test')).toEqual([])
  })

  it('returns empty array when all inputs are empty arrays', () => {
    expect(mergeSearchResults([], [], new Map(), 'test')).toEqual([])
  })

  it('scores exact title matches highest', () => {
    const dragon = mockItem('1', 'Dragon')
    const dragonborn = mockItem('2', 'Dragonborn')
    const aDragonTale = mockItem('3', 'A Dragon Tale')

    const results = mergeSearchResults(
      [dragonborn, aDragonTale, dragon],
      undefined,
      new Map(),
      'dragon',
    )

    expect(results[0].item.name).toBe('Dragon')
    expect(results[1].item.name).toBe('Dragonborn')
    expect(results[2].item.name).toBe('A Dragon Tale')
  })

  it('scores case-insensitively', () => {
    const item = mockItem('1', 'dragon')
    const results = mergeSearchResults([item], undefined, new Map(), 'DRAGON')
    expect(results[0].matchType).toBe('title')
  })

  it('returns body-only matches with matchText', () => {
    const noteA = mockItem('a', 'Note A')
    const noteB = mockItem('b', 'Note B')
    const map = buildItemsMap([noteA, noteB])

    const results = mergeSearchResults(
      [],
      [mockBlock('a', 'some body text'), mockBlock('b', 'other body text')],
      map,
      'text',
    )

    expect(results).toHaveLength(2)
    expect(results[0].matchType).toBe('body')
    expect(results[0].matchText).toBe('some body text')
    expect(results[1].matchType).toBe('body')
  })

  it('handles undefined bodyResults', () => {
    const item = mockItem('1', 'Test')
    const results = mergeSearchResults([item], undefined, new Map(), 'test')
    expect(results).toHaveLength(1)
    expect(results[0].matchType).toBe('title')
  })

  it('deduplicates items that match both title and body', () => {
    const note = mockItem('1', 'Dragon')
    const map = buildItemsMap([note])

    const results = mergeSearchResults([note], [mockBlock('1', 'a dragon appears')], map, 'dragon')

    expect(results).toHaveLength(1)
    expect(results[0].matchType).toBe('title')
  })

  it('deduplicates multiple body blocks from the same note', () => {
    const note = mockItem('1', 'Note')
    const map = buildItemsMap([note])

    const results = mergeSearchResults(
      [],
      [mockBlock('1', 'first match'), mockBlock('1', 'second match')],
      map,
      'match',
    )

    expect(results).toHaveLength(1)
    expect(results[0].matchText).toBe('first match')
  })

  it('skips body results whose noteId is not in itemsMap', () => {
    const results = mergeSearchResults(
      [],
      [mockBlock('missing', 'orphaned block')],
      new Map(),
      'orphaned',
    )

    expect(results).toEqual([])
  })

  it('preserves backend order for body results', () => {
    const noteA = mockItem('a', 'Note A')
    const noteB = mockItem('b', 'Note B')
    const noteC = mockItem('c', 'Note C')
    const map = buildItemsMap([noteA, noteB, noteC])

    const results = mergeSearchResults(
      [],
      [mockBlock('c', 'third'), mockBlock('a', 'first'), mockBlock('b', 'second')],
      map,
      'query',
    )

    expect(results.map((r) => r.item.name)).toEqual(['Note C', 'Note A', 'Note B'])
  })

  it('preserves relative order for title matches with the same score', () => {
    const alpha = mockItem('1', 'Alpha contains')
    const beta = mockItem('2', 'Beta contains')
    const gamma = mockItem('3', 'Gamma contains')

    const results = mergeSearchResults([alpha, beta, gamma], undefined, new Map(), 'contains')

    expect(results.map((r) => r.item.name)).toEqual([
      'Alpha contains',
      'Beta contains',
      'Gamma contains',
    ])
  })

  it('places title matches before body matches', () => {
    const titleItem = mockItem('1', 'Dragon')
    const bodyItem = mockItem('2', 'Unrelated Name')
    const map = buildItemsMap([titleItem, bodyItem])

    const results = mergeSearchResults(
      [titleItem],
      [mockBlock('2', 'a dragon in the body')],
      map,
      'dragon',
    )

    expect(results[0].matchType).toBe('title')
    expect(results[1].matchType).toBe('body')
  })

  it('handles body result with empty plainText', () => {
    const note = mockItem('1', 'Note')
    const map = buildItemsMap([note])

    const results = mergeSearchResults([], [mockBlock('1', '')], map, 'query')

    expect(results).toHaveLength(1)
    expect(results[0].matchText).toBe('')
  })
})
