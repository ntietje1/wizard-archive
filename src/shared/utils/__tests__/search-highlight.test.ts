import { describe, expect, it } from 'vitest'
import { getHighlightRanges } from '~/shared/utils/search-highlight'

describe('getHighlightRanges', () => {
  it('returns empty array for empty query', () => {
    expect(getHighlightRanges('hello', '')).toEqual([])
  })

  it('returns empty array for whitespace-only query', () => {
    expect(getHighlightRanges('hello', '   ')).toEqual([])
  })

  it('returns empty array when no match found', () => {
    expect(getHighlightRanges('hello', 'xyz')).toEqual([])
  })

  it('finds a single match', () => {
    expect(getHighlightRanges('hello world', 'world')).toEqual([{ start: 6, end: 11 }])
  })

  it('finds multiple non-overlapping matches', () => {
    expect(getHighlightRanges('abc def abc', 'abc')).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 11 },
    ])
  })

  it('matches case-insensitively', () => {
    expect(getHighlightRanges('Hello WORLD', 'hello')).toEqual([{ start: 0, end: 5 }])
  })

  it('handles multi-term query with separate ranges', () => {
    expect(getHighlightRanges('foo bar baz', 'foo baz')).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 11 },
    ])
  })

  it('merges overlapping ranges from different terms', () => {
    expect(getHighlightRanges('test', 'te est')).toEqual([{ start: 0, end: 4 }])
  })

  it('merges adjacent ranges', () => {
    expect(getHighlightRanges('ab', 'a b')).toEqual([{ start: 0, end: 2 }])
  })

  it('returns empty array when query is longer than text', () => {
    expect(getHighlightRanges('hi', 'hello world')).toEqual([])
  })

  it('finds single character matches', () => {
    expect(getHighlightRanges('abcabc', 'a')).toEqual([
      { start: 0, end: 1 },
      { start: 3, end: 4 },
    ])
  })

  it('merges overlapping matches from the same term', () => {
    expect(getHighlightRanges('aaa', 'aa')).toEqual([{ start: 0, end: 3 }])
  })

  it('returns empty array for empty text with non-empty query', () => {
    expect(getHighlightRanges('', 'hello')).toEqual([])
  })

  it('handles match at position 0', () => {
    expect(getHighlightRanges('hello', 'hel')).toEqual([{ start: 0, end: 3 }])
  })

  it('handles match at end of text', () => {
    expect(getHighlightRanges('hello', 'llo')).toEqual([{ start: 2, end: 5 }])
  })

  it('deduplicates when query contains the same term twice', () => {
    expect(getHighlightRanges('abc', 'abc abc')).toEqual([{ start: 0, end: 3 }])
  })

  it('merges repeated single-character matches into contiguous range', () => {
    expect(getHighlightRanges('aaa', 'a')).toEqual([{ start: 0, end: 3 }])
  })

  it('treats special regex characters as literals', () => {
    expect(getHighlightRanges('test.case', '.')).toEqual([{ start: 4, end: 5 }])
  })

  it('handles unicode characters', () => {
    expect(getHighlightRanges('café latte', 'é')).toEqual([{ start: 3, end: 4 }])
  })
})
