import { describe, expect, it } from 'vite-plus/test'
import { getCanvasVisualSelectionState } from '../canvas-selection'

describe('getCanvasVisualSelectionState', () => {
  it('keeps committed items visible during additive previews', () => {
    expect(
      getCanvasVisualSelectionState({
        selected: true,
        pendingPreview: { kind: 'active', nodeIds: new Set(['incoming']), edgeIds: new Set() },
        gestureMode: 'add',
        id: 'committed',
        kind: 'node',
      }).visuallySelected,
    ).toBe(true)
  })

  it('replaces committed visual selection during replacement previews', () => {
    expect(
      getCanvasVisualSelectionState({
        selected: true,
        pendingPreview: { kind: 'active', nodeIds: new Set(['incoming']), edgeIds: new Set() },
        gestureMode: 'replace',
        id: 'committed',
        kind: 'node',
      }).visuallySelected,
    ).toBe(false)
  })
})
