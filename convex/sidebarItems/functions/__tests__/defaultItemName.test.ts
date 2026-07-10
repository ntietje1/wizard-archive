import { describe, expect, it } from 'vitest'
import { deduplicateName } from '@wizard-archive/editor/resources/items'

describe('deduplicateName', () => {
  it('uses base, then base 1, base 2, and so on', () => {
    expect(deduplicateName('Scene', [])).toBe('Scene')
    expect(deduplicateName('Scene', ['Scene'])).toBe('Scene 1')
    expect(deduplicateName('Scene', ['Scene', 'Scene 1'])).toBe('Scene 2')
    expect(deduplicateName('Scene', ['Scene', 'Scene 2'])).toBe('Scene 1')
  })

  it('does not append numeric suffixes to generated numeric suffixes', () => {
    expect(
      deduplicateName('Untitled Note 2 3 3 2', [
        'Untitled Note',
        'Untitled Note 1',
        'Untitled Note 2',
        'Untitled Note 2 3 3 2',
      ]),
    ).toBe('Untitled Note 3')
  })

  it('preserves chained numeric names when no sibling sequence claims the base', () => {
    expect(deduplicateName('Untitled Note 2 3 3 2', ['Untitled Note 2 3 3 2'])).toBe(
      'Untitled Note 2 3 3 2 1',
    )
  })

  it('preserves user-authored trailing numbers that are not part of an existing suffix sequence', () => {
    expect(deduplicateName('Scene 1778718519495', ['Scene 1778718519495'])).toBe(
      'Scene 1778718519495 1',
    )
  })

  it('compares sibling names case-insensitively', () => {
    expect(deduplicateName('Scene', ['scene', 'SCENE 1'])).toBe('Scene 2')
  })

  it('truncates the base before appending a complete numeric suffix', () => {
    const name = 'A'.repeat(255)

    const deduplicated = deduplicateName(name, [name])

    expect(deduplicated).toHaveLength(255)
    expect(deduplicated.endsWith(' 1')).toBe(true)
  })
})
