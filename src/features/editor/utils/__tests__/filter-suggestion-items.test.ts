import { describe, expect, it } from 'vitest'
import { filterSuggestionItems } from '~/features/editor/utils/filter-suggestion-items'

const items = [
  { title: 'Heading', aliases: ['h', 'header'] },
  { title: 'Paragraph', aliases: ['p', 'text'] },
  { title: 'Bullet List', aliases: ['ul', 'unordered'] },
]

describe('filterSuggestionItems', () => {
  it('returns all items for empty query', () => {
    expect(filterSuggestionItems(items, '')).toHaveLength(3)
    expect(filterSuggestionItems(items, '  ')).toHaveLength(3)
  })

  it('filters by title (case-insensitive)', () => {
    expect(filterSuggestionItems(items, 'head')).toEqual([items[0]])
    expect(filterSuggestionItems(items, 'HEAD')).toEqual([items[0]])
  })

  it('filters by alias', () => {
    expect(filterSuggestionItems(items, 'ul')).toEqual([items[2]])
  })

  it('returns empty array when nothing matches', () => {
    expect(filterSuggestionItems(items, 'xyz')).toEqual([])
  })

  it('matches partial titles', () => {
    expect(filterSuggestionItems(items, 'let')).toEqual([items[2]])
  })
})
