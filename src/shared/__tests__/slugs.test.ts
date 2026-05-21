import { describe, expect, it } from 'vite-plus/test'
import { deduplicateSlug, parseSlug, slugify, validateSlug } from '../../../shared/slugs'

describe('slugify', () => {
  it('generates lowercase hyphen-separated slugs', () => {
    expect(slugify('Attack Bonus')).toBe('attack-bonus')
    expect(slugify('attack_bonus')).toBe('attack-bonus')
    expect(slugify('attack-_bonus')).toBe('attack-bonus')
    expect(slugify('42 Things')).toBe('42-things')
  })

  it('removes invalid punctuation and trims generated separators', () => {
    expect(slugify('---hello@world!---')).toBe('helloworld')
    expect(slugify('日本語')).toBe('')
    expect(slugify('🎉🎊')).toBe('')
  })

  it('uses a normalized fallback when input normalizes to empty', () => {
    expect(slugify('🎉', { fallback: 'Fallback Slug' })).toBe('fallback-slug')
  })
})

describe('validateSlug', () => {
  it('accepts digits, hyphens, and underscores', () => {
    expect(validateSlug('42-bonus')).toBeNull()
    expect(validateSlug('attack_bonus')).toBeNull()
    expect(parseSlug('attack_bonus')).toBe('attack_bonus')
  })

  it('rejects invalid universal slug syntax', () => {
    expect(validateSlug('')).toBe('Slug is required')
    expect(validateSlug('Attack')).toContain('uppercase')
    expect(validateSlug('attack bonus')).toContain('spaces')
    expect(validateSlug('attack!')).toContain(
      'lowercase letters, numbers, hyphens, and underscores',
    )
    expect(validateSlug('-attack')).toContain('separator')
    expect(validateSlug('attack_')).toContain('separator')
    expect(validateSlug('attack--bonus')).toContain('consecutive separators')
    expect(validateSlug('attack-_bonus')).toContain('consecutive separators')
  })

  it('uses configured labels and max lengths', () => {
    expect(validateSlug('', { label: 'Value slug' })).toBe('Value slug is required')
    expect(validateSlug('abcd', { label: 'Value slug', maxLength: 3 })).toBe(
      'Value slug must be at most 3 characters',
    )
  })
})

describe('deduplicateSlug', () => {
  it('returns base, then -1, then -2', () => {
    expect(deduplicateSlug('value', [])).toBe('value')
    expect(deduplicateSlug('value', ['value'])).toBe('value-1')
    expect(deduplicateSlug('value', ['value', 'value-1'])).toBe('value-2')
  })

  it('increments a trailing numeric suffix', () => {
    expect(deduplicateSlug('value-2', ['value', 'value-1', 'value-2'])).toBe('value-3')
    expect(deduplicateSlug('value_2', ['value_2'])).toBe('value_3')
    expect(deduplicateSlug('value-2-2-2', ['value-2-2-2'])).toBe('value-2-2-3')
  })

  it('treats any trailing numeric suffix as the dedupe counter', () => {
    expect(deduplicateSlug('roll-1778718519495', ['roll-1778718519495'])).toBe('roll-1778718519496')
  })

  it('truncates the base before appending the suffix', () => {
    expect(deduplicateSlug('abcde', ['abcde'], { maxLength: 5 })).toBe('abc-1')
  })
})
