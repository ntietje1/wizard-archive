import { describe, expect, it } from 'vitest'
import {
  getNextSelectedIds,
  isExclusivelySelectedNode,
  isPrimarySelectionModifier,
  mergeSelectedIds,
} from '../canvas-selection-utils'

describe('canvas-selection-utils', () => {
  it('treats ctrl as the primary selection modifier on windows and linux', () => {
    expect(isPrimarySelectionModifier({ ctrlKey: true, metaKey: false }, 'windows')).toBe(true)
    expect(isPrimarySelectionModifier({ ctrlKey: true, metaKey: false }, 'linux')).toBe(true)
    expect(isPrimarySelectionModifier({ ctrlKey: false, metaKey: true }, 'windows')).toBe(false)
    expect(isPrimarySelectionModifier({ ctrlKey: false, metaKey: false }, 'linux')).toBe(false)
  })

  it('treats meta as the primary selection modifier on mac', () => {
    expect(isPrimarySelectionModifier({ ctrlKey: false, metaKey: true }, 'mac')).toBe(true)
    expect(isPrimarySelectionModifier({ ctrlKey: true, metaKey: false }, 'mac')).toBe(false)
    expect(isPrimarySelectionModifier({ ctrlKey: false, metaKey: false }, 'mac')).toBe(false)
  })

  it('unions committed selection ids without duplicates when additive gestures merge', () => {
    expect(mergeSelectedIds(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
    expect(mergeSelectedIds([], ['b', 'c'])).toEqual(['b', 'c'])
  })

  it('keeps modifier-click on empty canvas from clearing selection', () => {
    expect(
      getNextSelectedIds({
        selectedIds: ['a', 'b'],
        targetId: null,
        toggle: true,
      }),
    ).toEqual(['a', 'b'])

    expect(
      getNextSelectedIds({
        selectedIds: ['a', 'b'],
        targetId: null,
        toggle: false,
      }),
    ).toEqual([])
  })

  it('toggles only the clicked node when a modifier is pressed', () => {
    expect(
      getNextSelectedIds({
        selectedIds: ['a', 'b'],
        targetId: 'c',
        toggle: true,
      }),
    ).toEqual(['a', 'b', 'c'])

    expect(
      getNextSelectedIds({
        selectedIds: ['a', 'b'],
        targetId: 'b',
        toggle: true,
      }),
    ).toEqual(['a'])

    expect(
      getNextSelectedIds({
        selectedIds: ['a', 'b'],
        targetId: 'b',
        toggle: false,
      }),
    ).toEqual(['b'])

    expect(
      getNextSelectedIds({
        selectedIds: ['a', 'b'],
        targetId: 'c',
        toggle: false,
      }),
    ).toEqual(['c'])
  })

  it('treats a node as exclusively selected only when it is the sole selection', () => {
    expect(isExclusivelySelectedNode(['embed-1'], 'embed-1')).toBe(true)
    expect(isExclusivelySelectedNode(['embed-1', 'text-1'], 'embed-1')).toBe(false)
    expect(isExclusivelySelectedNode(['text-1'], 'embed-1')).toBe(false)
    expect(isExclusivelySelectedNode([], 'embed-1')).toBe(false)
    expect(isExclusivelySelectedNode(['embed-1'], null)).toBe(false)
  })
})
