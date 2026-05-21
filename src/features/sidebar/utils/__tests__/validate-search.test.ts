import { describe, expect, it } from 'vitest'
import { validateSearch } from '~/features/sidebar/utils/validate-search'

describe('validateSearch', () => {
  it('returns empty object for empty input', () => {
    expect(validateSearch({})).toEqual({})
  })

  it('extracts item slug', () => {
    expect(validateSearch({ item: 'my-note' })).toEqual({ item: 'my-note' })
  })

  it('extracts heading', () => {
    expect(validateSearch({ heading: 'intro' })).toEqual({ heading: 'intro' })
  })

  it('extracts trash flag', () => {
    expect(validateSearch({ trash: true })).toEqual({ trash: true })
  })

  it('extracts all fields together', () => {
    expect(validateSearch({ item: 'note', heading: 'h1', trash: true })).toEqual({
      item: 'note',
      heading: 'h1',
      trash: true,
    })
  })

  it('trims whitespace from strings', () => {
    expect(validateSearch({ item: '  slug  ' })).toEqual({ item: 'slug' })
    expect(validateSearch({ heading: '  head  ' })).toEqual({
      heading: 'head',
    })
  })

  it('ignores whitespace-only strings', () => {
    expect(validateSearch({ item: '   ' })).toEqual({})
    expect(validateSearch({ heading: '   ' })).toEqual({})
  })

  it('ignores empty strings', () => {
    expect(validateSearch({ item: '' })).toEqual({})
    expect(validateSearch({ heading: '' })).toEqual({})
  })

  it('ignores invalid item slugs', () => {
    expect(validateSearch({ item: 'bad slug' })).toEqual({})
    expect(validateSearch({ item: 'Bad-Slug' })).toEqual({})
    expect(validateSearch({ item: '-leading-hyphen' })).toEqual({})
    expect(validateSearch({ item: 'trailing-hyphen-' })).toEqual({})
    expect(validateSearch({ item: 'special@char' })).toEqual({})
  })
  it('accepts valid slugs with numbers', () => {
    expect(validateSearch({ item: 'item-123' })).toEqual({ item: 'item-123' })
  })

  it('accepts non-empty item slugs without a minimum length', () => {
    expect(validateSearch({ item: 'a' })).toEqual({ item: 'a' })
    expect(validateSearch({ item: 'aa' })).toEqual({ item: 'aa' })
  })

  it('accepts multi-part slugs with hyphens and underscores', () => {
    expect(validateSearch({ item: 'a-b' })).toEqual({ item: 'a-b' })
    expect(validateSearch({ item: 'a_b' })).toEqual({ item: 'a_b' })
    expect(validateSearch({ item: 'a-b-c' })).toEqual({ item: 'a-b-c' })
    expect(validateSearch({ item: 'double--hyphen' })).toEqual({})
    expect(validateSearch({ item: 'mixed-_separator' })).toEqual({})
  })

  it('does not enforce minimum length for headings', () => {
    expect(validateSearch({ heading: 'h' })).toEqual({ heading: 'h' })
    expect(validateSearch({ heading: 'hh' })).toEqual({ heading: 'hh' })
  })

  it('ignores non-string item/heading values', () => {
    expect(validateSearch({ item: 123, heading: true })).toEqual({})
  })

  it('ignores trash when not exactly true', () => {
    expect(validateSearch({ trash: false })).toEqual({})
    expect(validateSearch({ trash: 'yes' })).toEqual({})
  })

  it('ignores unknown fields', () => {
    expect(validateSearch({ foo: 'bar', item: 'slug' })).toEqual({
      item: 'slug',
    })
  })
})
