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
    setCanvasPendingSelectionPreview({
      nodeIds: ['node-1', 'node-2'],
      edgeIds: ['edge-1'],
    })

    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toEqual(
      new Set(['node-1', 'node-2']),
    )
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingEdgeIds).toEqual(
      new Set(['edge-1']),
    )

    clearCanvasPendingSelectionPreview()

    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toBeNull()
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingEdgeIds).toEqual(new Set())
  })

  it('distinguishes an active empty preview from an inactive preview', () => {
    setCanvasPendingSelectionPreview({ nodeIds: [], edgeIds: [] })

    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toEqual(new Set())
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingEdgeIds).toEqual(new Set())
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).not.toBeNull()
  })

  it('keeps the existing set reference when the effective preview ids are unchanged', () => {
    setCanvasPendingSelectionPreview({
      nodeIds: ['node-1', 'node-2'],
      edgeIds: ['edge-1'],
    })
    const initialPendingNodeIds = useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds
    const initialPendingEdgeIds = useCanvasPendingSelectionPreviewStore.getState().pendingEdgeIds

    setCanvasPendingSelectionPreview({
      nodeIds: ['node-2', 'node-1'],
      edgeIds: ['edge-1'],
    })

    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toBe(
      initialPendingNodeIds,
    )
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingEdgeIds).toBe(
      initialPendingEdgeIds,
    )
  })
})
