import { describe, expect, it } from 'vite-plus/test'
import {
  parseWorkspaceRouteSearchParams,
  validateSearch,
} from '~/editor-adapters/workspace-route-search'

describe('validateSearch', () => {
  it('extracts item slug', () => {
    expect(validateSearch({ item: 'my-note' })).toEqual({ item: 'my-note' })
  })

  it('only accepts headings for a resource route', () => {
    expect(validateSearch({ heading: 'intro' })).toEqual({})
    expect(validateSearch({ item: 'my-note', heading: 'intro' })).toEqual({
      item: 'my-note',
      heading: 'intro',
    })
  })

  it('extracts trash flag', () => {
    expect(validateSearch({ trash: true })).toEqual({ trash: true })
  })

  it('rejects simultaneous resource and trash modes', () => {
    expect(validateSearch({ item: 'note', heading: 'h1', trash: true })).toEqual({})
  })

  it('trims whitespace from strings', () => {
    expect(validateSearch({ item: '  slug  ' })).toEqual({ item: 'slug' })
    expect(validateSearch({ item: 'slug', heading: '  head  ' })).toEqual({
      item: 'slug',
      heading: 'head',
    })
  })

  it('accepts valid slugs with numbers', () => {
    expect(validateSearch({ item: 'item-123' })).toEqual({ item: 'item-123' })
  })

  it('accepts one-character item slugs', () => {
    expect(validateSearch({ item: 'a' })).toEqual({ item: 'a' })
    expect(validateSearch({ item: 'aa' })).toEqual({ item: 'aa' })
  })

  it('accepts multi-part slugs with hyphens and underscores', () => {
    expect(validateSearch({ item: 'a-b' })).toEqual({ item: 'a-b' })
    expect(validateSearch({ item: 'a_b' })).toEqual({ item: 'a_b' })
    expect(validateSearch({ item: 'a-b-c' })).toEqual({ item: 'a-b-c' })
  })

  it('accepts one-character headings', () => {
    expect(validateSearch({ item: 'note', heading: 'h' })).toEqual({ item: 'note', heading: 'h' })
    expect(validateSearch({ item: 'note', heading: 'hh' })).toEqual({
      item: 'note',
      heading: 'hh',
    })
  })

  it('drops oversized headings', () => {
    expect(validateSearch({ heading: 'h'.repeat(513), item: 'note' })).toEqual({ item: 'note' })
  })

  it('drops invalid item, heading, and trash shapes', () => {
    expect(validateSearch({ item: '', heading: '', trash: false })).toEqual({})
    expect(validateSearch({ item: '   ', heading: '   ', trash: 'true' })).toEqual({})
    expect(validateSearch({ item: 123, heading: ['intro'], trash: 1 })).toEqual({})
  })

  it('rejects malformed resource intents as a whole', () => {
    expect(validateSearch({ item: '../private-note', heading: 'intro', trash: true })).toEqual({})
  })
})

describe('parseWorkspaceRouteSearchParams', () => {
  it('rejects URL search params that request resource and trash modes together', () => {
    const searchParams = new URLSearchParams({
      item: '  session-notes  ',
      heading: '  Intro  ',
      trash: 'true',
    })

    expect(parseWorkspaceRouteSearchParams(searchParams)).toEqual({})
  })

  it('drops malformed URL search params', () => {
    const searchParams = new URLSearchParams({
      item: '../private-note',
      heading: 'h'.repeat(513),
      trash: 'false',
    })

    expect(parseWorkspaceRouteSearchParams(searchParams)).toEqual({})
  })
})
