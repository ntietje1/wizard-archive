import { describe, expect, it } from 'vitest'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { BlockSearchResult } from '../../../../../shared/search/types'
import { createNote } from '../../test/sidebar-item-factory'
import { buildItemSearchResults } from '../model'

describe('buildItemSearchResults', () => {
  it('orders title matches by exact, prefix, then contains priority', () => {
    const contains = createNote({
      id: 'note_contains' as SidebarItemId,
      name: 'Ancient Dragon Lore',
    })
    const exact = createNote({ id: 'note_exact' as SidebarItemId, name: 'Dragon' })
    const prefix = createNote({ id: 'note_prefix' as SidebarItemId, name: 'Dragon Market' })

    const results = buildItemSearchResults({
      bodyResults: undefined,
      getBreadcrumb: (item) => `/${item.name}`,
      items: [contains, prefix, exact],
      query: 'dragon',
    })

    expect(results.map((result) => result.itemId)).toEqual([exact.id, prefix.id, contains.id])
    expect(results.map((result) => result.matchType)).toEqual(['title', 'title', 'title'])
    expect(results.map((result) => result.breadcrumb)).toEqual([
      '/Dragon',
      '/Dragon Market',
      '/Ancient Dragon Lore',
    ])
  })

  it('dedupes body results while excluding notes that already matched by title', () => {
    const titleMatch = createNote({
      id: 'note_title' as SidebarItemId,
      name: 'Dragon',
    })
    const bodyMatch = createNote({
      id: 'note_body' as SidebarItemId,
      name: 'Market Notes',
    })
    const missingId = 'note_missing' as SidebarItemId
    const bodyResults: Array<BlockSearchResult> = [
      createBodyResult(titleMatch.id, 'title match body should be skipped'),
      createBodyResult(bodyMatch.id, 'first body hit wins'),
      createBodyResult(bodyMatch.id, 'duplicate body hit should be skipped'),
      createBodyResult(missingId, 'missing item should be skipped'),
    ]

    const results = buildItemSearchResults({
      bodyResults,
      getBreadcrumb: () => '',
      items: [titleMatch, bodyMatch],
      query: 'dragon',
    })

    expect(results).toHaveLength(2)
    expect(results.map((result) => [result.itemId, result.matchType, result.matchText])).toEqual([
      [titleMatch.id, 'title', null],
      [bodyMatch.id, 'body', 'first body hit wins'],
    ])
    expect(results[1]?.resource).toEqual({
      kind: 'resource',
      uri: `resource:${bodyMatch.id}`,
    })
    expect(results[1]?.item).toBe(bodyMatch)
  })
})

function createBodyResult(noteId: SidebarItemId, plainText: string): BlockSearchResult {
  return {
    blockNoteId: `${noteId}-block`,
    noteId,
    plainText,
    type: 'paragraph',
  }
}
