import { describe, expect, it } from 'vitest'
import { getItemSelectionIntent } from '~/features/sidebar/utils/item-selection-intent'

describe('getItemSelectionIntent', () => {
  it('uses range selection for shift clicks', () => {
    expect(getItemSelectionIntent({ shiftKey: true, metaKey: false, ctrlKey: false })).toBe('range')
  })

  it('uses toggle selection for ctrl or meta clicks', () => {
    for (const modifiers of [
      { metaKey: true, ctrlKey: false },
      { metaKey: false, ctrlKey: true },
    ]) {
      expect(getItemSelectionIntent({ shiftKey: false, ...modifiers })).toBe('toggle')
    }
  })

  it('uses single selection for plain clicks', () => {
    expect(getItemSelectionIntent({ shiftKey: false, metaKey: false, ctrlKey: false })).toBe(
      'single',
    )
  })

  it('prioritizes range selection over toggle modifiers', () => {
    for (const modifiers of [
      { metaKey: true, ctrlKey: false },
      { metaKey: false, ctrlKey: true },
      { metaKey: true, ctrlKey: true },
    ]) {
      expect(getItemSelectionIntent({ shiftKey: true, ...modifiers })).toBe('range')
    }
  })

  it('uses toggle selection when ctrl and meta are both pressed without shift', () => {
    expect(getItemSelectionIntent({ shiftKey: false, metaKey: true, ctrlKey: true })).toBe('toggle')
  })
})
