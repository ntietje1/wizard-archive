import { describe, expect, it } from 'vitest'
import {
  getNextSelectedIds,
  isExclusivelySelectedNode,
  isPrimarySelectionModifier,
  areStringSetsEqual,
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
    expect(mergeSelectedIds(new Set(['a', 'b']), new Set(['b', 'c']))).toEqual(
      new Set(['a', 'b', 'c']),
    )
    expect(mergeSelectedIds(new Set(), new Set(['b', 'c']))).toEqual(new Set(['b', 'c']))
  })

  it('compares set membership without requiring array conversion', () => {
    expect(areStringSetsEqual(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
    expect(areStringSetsEqual(new Set(['a', 'b']), new Set(['a', 'c']))).toBe(false)
  })

  it('keeps modifier-click on empty canvas from clearing selection', () => {
    expect(
      getNextSelectedIds({
        selectedIds: new Set(['a', 'b']),
        targetId: null,
        toggle: true,
      }),
    ).toEqual(new Set(['a', 'b']))

    expect(
      getNextSelectedIds({
        selectedIds: new Set(['a', 'b']),
        targetId: null,
        toggle: false,
      }),
    ).toEqual(new Set())
  })

  it('toggles only the clicked node when a modifier is pressed', () => {
    expect(
      getNextSelectedIds({
        selectedIds: new Set(['a', 'b']),
        targetId: 'c',
        toggle: true,
      }),
    ).toEqual(new Set(['a', 'b', 'c']))

    expect(
      getNextSelectedIds({
        selectedIds: new Set(['a', 'b']),
        targetId: 'b',
        toggle: true,
      }),
    ).toEqual(new Set(['a']))

    expect(
      getNextSelectedIds({
        selectedIds: new Set(['a', 'b']),
        targetId: 'b',
        toggle: false,
      }),
    ).toEqual(new Set(['b']))

    expect(
      getNextSelectedIds({
        selectedIds: new Set(['a', 'b']),
        targetId: 'c',
        toggle: false,
      }),
    ).toEqual(new Set(['c']))
  })

  it('treats a node as exclusively selected only when it is the sole selection', () => {
    expect(isExclusivelySelectedNode(new Set(['embed-1']), 'embed-1')).toBe(true)
    expect(isExclusivelySelectedNode(new Set(['embed-1', 'text-1']), 'embed-1')).toBe(false)
    expect(isExclusivelySelectedNode(new Set(['text-1']), 'embed-1')).toBe(false)
    expect(isExclusivelySelectedNode(new Set(), 'embed-1')).toBe(false)
    expect(isExclusivelySelectedNode(new Set(['embed-1']), null)).toBe(false)
  })
})
