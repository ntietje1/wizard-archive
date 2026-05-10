import { describe, expect, it } from 'vitest'
import { getItemSelectionIntent } from '~/features/sidebar/utils/item-selection-intent'

describe('getItemSelectionIntent', () => {
  it('uses range selection for shift clicks', () => {
    expect(getItemSelectionIntent({ shiftKey: true, metaKey: false, ctrlKey: false })).toBe('range')
  })

  it.each([
    ['meta', { metaKey: true, ctrlKey: false }],
    ['ctrl', { metaKey: false, ctrlKey: true }],
  ])('uses toggle selection for %s clicks', (_label, modifiers) => {
    expect(getItemSelectionIntent({ shiftKey: false, ...modifiers })).toBe('toggle')
  })

  it('uses single selection for plain clicks', () => {
    expect(getItemSelectionIntent({ shiftKey: false, metaKey: false, ctrlKey: false })).toBe(
      'single',
    )
  })

  it.each([
    ['shift+meta', { metaKey: true, ctrlKey: false }],
    ['shift+ctrl', { metaKey: false, ctrlKey: true }],
    ['shift+meta+ctrl', { metaKey: true, ctrlKey: true }],
  ])('prioritizes range selection over %s', (_label, modifiers) => {
    expect(getItemSelectionIntent({ shiftKey: true, ...modifiers })).toBe('range')
  })

  it('uses toggle selection when ctrl and meta are both pressed without shift', () => {
    expect(getItemSelectionIntent({ shiftKey: false, metaKey: true, ctrlKey: true })).toBe('toggle')
  })
})
