import { describe, expect, it } from 'vitest'
import {
  getNextSelectedNodeIds,
  isExclusivelySelectedNode,
  isSelectionToggleModifier,
} from '../canvas-selection-utils'

describe('canvas-selection-utils', () => {
  it('treats shift, ctrl, and meta as selection toggle modifiers', () => {
    expect(isSelectionToggleModifier({ shiftKey: true, ctrlKey: false, metaKey: false })).toBe(true)
    expect(isSelectionToggleModifier({ shiftKey: false, ctrlKey: true, metaKey: false })).toBe(true)
    expect(isSelectionToggleModifier({ shiftKey: false, ctrlKey: false, metaKey: true })).toBe(true)
    expect(isSelectionToggleModifier({ shiftKey: true, ctrlKey: true, metaKey: false })).toBe(true)
    expect(isSelectionToggleModifier({ shiftKey: true, ctrlKey: false, metaKey: true })).toBe(true)
    expect(isSelectionToggleModifier({ shiftKey: false, ctrlKey: true, metaKey: true })).toBe(true)
    expect(isSelectionToggleModifier({ shiftKey: false, ctrlKey: false, metaKey: false })).toBe(
      false,
    )
  })

  it('does not treat alt as a selection toggle modifier', () => {
    const altOnly = { shiftKey: false, ctrlKey: false, metaKey: false, altKey: true }

    expect(isSelectionToggleModifier(altOnly)).toBe(false)
  })

  it('keeps modifier-click on empty canvas from clearing selection', () => {
    expect(
      getNextSelectedNodeIds({
        selectedNodeIds: ['a', 'b'],
        targetId: null,
        toggle: true,
      }),
    ).toEqual(['a', 'b'])

    expect(
      getNextSelectedNodeIds({
        selectedNodeIds: ['a', 'b'],
        targetId: null,
        toggle: false,
      }),
    ).toEqual([])
  })

  it('toggles only the clicked node when a modifier is pressed', () => {
    expect(
      getNextSelectedNodeIds({
        selectedNodeIds: ['a', 'b'],
        targetId: 'c',
        toggle: true,
      }),
    ).toEqual(['a', 'b', 'c'])

    expect(
      getNextSelectedNodeIds({
        selectedNodeIds: ['a', 'b'],
        targetId: 'b',
        toggle: true,
      }),
    ).toEqual(['a'])

    expect(
      getNextSelectedNodeIds({
        selectedNodeIds: ['a', 'b'],
        targetId: 'b',
        toggle: false,
      }),
    ).toEqual(['b'])

    expect(
      getNextSelectedNodeIds({
        selectedNodeIds: ['a', 'b'],
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
