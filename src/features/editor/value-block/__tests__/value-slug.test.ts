import { describe, expect, it } from 'vitest'
import { getUniqueValueSlug } from '../../../../../shared/note-values/constants'

describe('getUniqueValueSlug', () => {
  it('uses base, then base_1, base_2, and so on', () => {
    expect(getUniqueValueSlug('value', [])).toBe('value')
    expect(getUniqueValueSlug('value', ['value'])).toBe('value_1')
    expect(getUniqueValueSlug('value', ['value', 'value_1'])).toBe('value_2')
    expect(getUniqueValueSlug('value', ['value', 'value_2'])).toBe('value_1')
  })

  it('does not append numeric suffixes to generated numeric suffixes', () => {
    expect(getUniqueValueSlug('value_2_2_2', ['value', 'value_1', 'value_2', 'value_2_2_2'])).toBe(
      'value_3',
    )
  })

  it('collapses chained numeric suffixes even if the clean base is available', () => {
    expect(getUniqueValueSlug('value_2_2_2', ['value_2_2_2'])).toBe('value')
  })

  it('preserves user-authored trailing numbers that are not part of an existing suffix sequence', () => {
    expect(getUniqueValueSlug('roll_1778718519495', ['roll_1778718519495'])).toBe(
      'roll_1778718519495_1',
    )
  })
})
