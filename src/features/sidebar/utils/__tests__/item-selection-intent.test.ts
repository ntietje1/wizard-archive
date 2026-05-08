import { describe, expect, it } from 'vitest'
import { getItemSelectionIntent } from '~/features/sidebar/utils/item-selection-intent'

describe('getItemSelectionIntent', () => {
  it('uses range selection for shift clicks', () => {
    expect(getItemSelectionIntent({ shiftKey: true, metaKey: false, ctrlKey: false })).toBe('range')
  })

  it('uses toggle selection for ctrl or meta clicks', () => {
    expect(getItemSelectionIntent({ shiftKey: false, metaKey: true, ctrlKey: false })).toBe(
      'toggle',
    )
    expect(getItemSelectionIntent({ shiftKey: false, metaKey: false, ctrlKey: true })).toBe(
      'toggle',
    )
  })

  it('uses single selection for plain clicks', () => {
    expect(getItemSelectionIntent({ shiftKey: false, metaKey: false, ctrlKey: false })).toBe(
      'single',
    )
  })

  it('prioritizes range selection over toggle modifiers', () => {
    expect(getItemSelectionIntent({ shiftKey: true, metaKey: true, ctrlKey: false })).toBe('range')
    expect(getItemSelectionIntent({ shiftKey: true, metaKey: false, ctrlKey: true })).toBe('range')
    expect(getItemSelectionIntent({ shiftKey: true, metaKey: true, ctrlKey: true })).toBe('range')
  })

  it('uses toggle selection when ctrl and meta are both pressed without shift', () => {
    expect(getItemSelectionIntent({ shiftKey: false, metaKey: true, ctrlKey: true })).toBe('toggle')
  })
})
