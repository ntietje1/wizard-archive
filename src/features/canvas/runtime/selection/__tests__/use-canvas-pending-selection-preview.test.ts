import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearCanvasPendingSelectionPreview,
  getCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
  useCanvasEdgePendingPreview,
  useCanvasNodePendingPreview,
  useCanvasPendingPreviewActive,
} from '../use-canvas-pending-selection-preview'

describe('useCanvasPendingSelectionPreview', () => {
  beforeEach(() => {
    clearCanvasPendingSelectionPreview()
  })

  it('stores a pending preview set and clears it back to inactive state', () => {
    setCanvasPendingSelectionPreview({
      nodeIds: new Set(['node-1', 'node-2']),
      edgeIds: new Set(['edge-1']),
    })

    expect(getCanvasPendingSelectionPreview()).toEqual({
      kind: 'active',
      nodeIds: new Set(['node-1', 'node-2']),
      edgeIds: new Set(['edge-1']),
    })

    clearCanvasPendingSelectionPreview()

    expect(getCanvasPendingSelectionPreview()).toEqual({ kind: 'inactive' })
  })

  it('distinguishes an active empty preview from an inactive preview', () => {
    setCanvasPendingSelectionPreview({ nodeIds: new Set<string>(), edgeIds: new Set<string>() })

    expect(getCanvasPendingSelectionPreview()).toEqual({
      kind: 'active',
      nodeIds: new Set(),
      edgeIds: new Set(),
    })
  })

  it('keeps the existing preview reference when the effective preview ids are unchanged', () => {
    setCanvasPendingSelectionPreview({
      nodeIds: new Set(['node-1', 'node-2']),
      edgeIds: new Set(['edge-1']),
    })
    const initialPreview = getCanvasPendingSelectionPreview()

    setCanvasPendingSelectionPreview({
      nodeIds: new Set(['node-2', 'node-1']),
      edgeIds: new Set(['edge-1']),
    })

    expect(getCanvasPendingSelectionPreview()).toBe(initialPreview)
  })

  it('exposes semantic selector hooks instead of requiring callers to read store shape', () => {
    const { result } = renderHook(() => ({
      active: useCanvasPendingPreviewActive(),
      nodeSelected: useCanvasNodePendingPreview('node-1'),
      edgeSelected: useCanvasEdgePendingPreview('edge-1'),
    }))

    expect(result.current).toEqual({
      active: false,
      nodeSelected: false,
      edgeSelected: false,
    })

    act(() => {
      setCanvasPendingSelectionPreview({
        nodeIds: new Set(['node-1']),
        edgeIds: new Set(['edge-1']),
      })
    })

    expect(result.current).toEqual({
      active: true,
      nodeSelected: true,
      edgeSelected: true,
    })
  })
})
