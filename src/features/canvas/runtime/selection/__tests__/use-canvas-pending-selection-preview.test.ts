import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
  useCanvasPendingSelectionPreviewStore,
} from '../use-canvas-pending-selection-preview'

describe('useCanvasPendingSelectionPreviewStore', () => {
  beforeEach(() => {
    clearCanvasPendingSelectionPreview()
  })

  it('stores a pending preview set and clears it back to inactive state', () => {
    setCanvasPendingSelectionPreview(['node-1', 'node-2'])

    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toEqual(
      new Set(['node-1', 'node-2']),
    )

    clearCanvasPendingSelectionPreview()

    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toBeNull()
  })

  it('distinguishes an active empty preview from an inactive preview', () => {
    setCanvasPendingSelectionPreview([])

    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toEqual(new Set())
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).not.toBeNull()
  })
})
