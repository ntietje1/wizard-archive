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
    })
    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['node-1']))

    act(() => {
      result.current.toggleNode('node-2', true)
    })
    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['node-1', 'node-2']))

    act(() => {
      result.current.toggleEdge('edge-1', true)
    })
    expect(canvasEngine.getSnapshot().selection.edgeIds).toEqual(new Set(['edge-1']))

    act(() => {
      result.current.toggleNode('node-2', true)
    })

    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['node-1']))
    expect(canvasEngine.getSnapshot().selection.edgeIds).toEqual(new Set(['edge-1']))
  })

  it('cancels an in-progress gesture and clears the pending preview', () => {
    const { result, canvasEngine } = renderController()

    act(() => {
      result.current.setSelection({ nodeIds: new Set(['existing']), edgeIds: new Set() })
      result.current.beginGesture('marquee', 'replace')
      result.current.setGesturePreview({ nodeIds: new Set(['previewed']), edgeIds: new Set() })
      result.current.cancelGesture()
    })

    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['existing']))
    expect(canvasEngine.getSnapshot().selection.pendingPreview).toEqual({ kind: 'inactive' })
  })

  it('clears an already-empty selection without changing engine state', () => {
    const { result, canvasEngine, setLocalSelection } = renderController()

    act(() => {
      result.current.clearSelection()
    })

    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set())
    expect(canvasEngine.getSnapshot().selection.edgeIds).toEqual(new Set())
    expect(setLocalSelection).not.toHaveBeenCalled()
  })

  it('applies an explicit empty selection snapshot', () => {
    const { result, canvasEngine } = renderController()

    act(() => {
      result.current.setSelection({ nodeIds: new Set(['node-1']), edgeIds: new Set(['edge-1']) })
      result.current.setSelection({ nodeIds: new Set(), edgeIds: new Set() })
    })

    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set())
    expect(canvasEngine.getSnapshot().selection.edgeIds).toEqual(new Set())
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

  it('supports sequential gesture commits', () => {
    const { result, canvasEngine } = renderController()

    act(() => {
      result.current.beginGesture('marquee', 'replace')
      result.current.setGesturePreview({ nodeIds: new Set(['first']), edgeIds: new Set() })
      result.current.commitGesture()
      result.current.beginGesture('lasso', 'replace')
      result.current.setGesturePreview({ nodeIds: new Set(['second']), edgeIds: new Set() })
      result.current.commitGesture()
    })

    expect(canvasEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['second']))
    expect(canvasEngine.getSnapshot().selection.pendingPreview).toEqual({ kind: 'inactive' })
  })
})
