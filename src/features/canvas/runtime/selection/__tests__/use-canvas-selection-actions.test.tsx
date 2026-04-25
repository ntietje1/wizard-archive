import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createCanvasEngine } from '../../../system/canvas-engine'
import { useCanvasSelectionController } from '../use-canvas-selection-actions'

describe('useCanvasSelectionController', () => {
  function renderController() {
    const canvasEngine = createCanvasEngine()
    const onSelectionChange = vi.fn()
    const setLocalSelection = vi.fn()
    const hook = renderHook(() =>
      useCanvasSelectionController({
        canvasEngine,
        onSelectionChange,
        setLocalSelection,
      }),
    )

    return { ...hook, canvasEngine, onSelectionChange, setLocalSelection }
  }

  it('sets and clears engine-owned selection snapshots', () => {
    const { result, canvasEngine, onSelectionChange, setLocalSelection } = renderController()

    act(() => {
      result.current.setSelection({
        nodeIds: new Set(['a', 'b']),
        edgeIds: new Set(['edge-1']),
      })
    })

    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['a', 'b']))
    expect(canvasEngine.getSnapshot().selection.edgeIds).toEqual(new Set(['edge-1']))
    expect(onSelectionChange).toHaveBeenCalledWith({
      nodeIds: new Set(['a', 'b']),
      edgeIds: new Set(['edge-1']),
    })
    expect(setLocalSelection).toHaveBeenCalledWith(new Set(['a', 'b']))

    act(() => {
      result.current.clearSelection()
    })

    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set())
    expect(canvasEngine.getSnapshot().selection.edgeIds).toEqual(new Set())
    expect(setLocalSelection).toHaveBeenLastCalledWith(null)
  })

  it('toggles nodes and edges through intent-level methods', () => {
    const { result, canvasEngine } = renderController()

    act(() => {
      result.current.toggleNode('node-1', false)
      result.current.toggleNode('node-2', true)
      result.current.toggleEdge('edge-1', true)
      result.current.toggleNode('node-2', true)
    })

    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['node-1']))
    expect(canvasEngine.getSnapshot().selection.edgeIds).toEqual(new Set(['edge-1']))
  })

  it('commits the cached engine gesture preview without passing a release-time selection', () => {
    const { result, canvasEngine } = renderController()

    act(() => {
      result.current.setSelection({ nodeIds: new Set(['existing']), edgeIds: new Set() })
      result.current.beginGesture('marquee', 'add')
      result.current.setGesturePreview({
        nodeIds: new Set(['existing', 'previewed']),
        edgeIds: new Set(['edge-1']),
      })
      result.current.commitGesture()
    })

    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['existing', 'previewed']))
    expect(canvasEngine.getSnapshot().selection.edgeIds).toEqual(new Set(['edge-1']))
    expect(canvasEngine.getSnapshot().selection.pendingPreview).toEqual({ kind: 'inactive' })
  })
})
