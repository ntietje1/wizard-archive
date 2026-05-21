import { describe, expect, it } from 'vite-plus/test'
import {
  NOTE_VALUE_DEFAULT_SLUG,
  NOTE_VALUE_SLUG_OPTIONS,
} from '../../../../../shared/note-values/constants'
import { deduplicateSlug, slugify, validateSlug } from '../../../../../shared/slugs'

describe('note value slugs', () => {
  it('uses universal slug validation', () => {
    expect(validateSlug('42_bonus', NOTE_VALUE_SLUG_OPTIONS)).toBeNull()
    expect(validateSlug('min', NOTE_VALUE_SLUG_OPTIONS)).toBeNull()
    expect(validateSlug('attack-_bonus', NOTE_VALUE_SLUG_OPTIONS)).toContain(
      'consecutive separators',
    )
  })

  it('generates hyphenated default slugs', () => {
    expect(slugify('Attack Bonus', NOTE_VALUE_SLUG_OPTIONS)).toBe('attack-bonus')
    expect(slugify('', { fallback: NOTE_VALUE_DEFAULT_SLUG })).toBe('value')
  })

  it('deduplicates with universal numeric suffixes', () => {
    expect(deduplicateSlug('value', [], NOTE_VALUE_SLUG_OPTIONS)).toBe('value')
    expect(deduplicateSlug('value', ['value'], NOTE_VALUE_SLUG_OPTIONS)).toBe('value-1')
    expect(deduplicateSlug('value', ['value', 'value-1'], NOTE_VALUE_SLUG_OPTIONS)).toBe('value-2')
    expect(
      deduplicateSlug('value-2', ['value', 'value-1', 'value-2'], NOTE_VALUE_SLUG_OPTIONS),
    ).toBe('value-3')
  })
})
