import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasSelectionController } from '../use-canvas-selection-actions'
import {
  useCanvasSelectionState,
  useIsCanvasSelectionGestureActive,
} from '../use-canvas-selection-state'
import type { Edge, Node } from '@xyflow/react'

const reactFlowMock = vi.hoisted(() => {
  let nodes: Array<Node> = []
  let edges: Array<Edge> = []

  return {
    getNodes: () => nodes,
    getEdges: () => edges,
    reset: () => {
      nodes = [
        {
          id: 'a',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {},
          selected: false,
          draggable: false,
        },
        {
          id: 'b',
          type: 'text',
          position: { x: 100, y: 0 },
          data: {},
          selected: false,
          draggable: false,
        },
      ]
      edges = [{ id: 'e-a-b', source: 'a', target: 'b', selected: false }]
    },
    setNodes: (updater: Array<Node> | ((nodes: Array<Node>) => Array<Node>)) => {
      nodes = typeof updater === 'function' ? updater(nodes) : updater
    },
    setEdges: (updater: Array<Edge> | ((edges: Array<Edge>) => Array<Edge>)) => {
      edges = typeof updater === 'function' ? updater(edges) : updater
    },
  }
})

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
}))

describe('useCanvasSelectionController', () => {
  beforeEach(() => {
    reactFlowMock.reset()
    useCanvasSelectionState.getState().reset()
  })

  it('sets authoritative selected ids and projects them onto React Flow nodes and edges', () => {
    const { result } = renderHook(() => useCanvasSelectionController())

    act(() => {
      result.current.replace({ nodeIds: ['a', 'b'], edgeIds: ['e-a-b'] })
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual(['a', 'b'])
    expect(useCanvasSelectionState.getState().selectedEdgeIds).toEqual(['e-a-b'])
    expect(reactFlowMock.getNodes()).toEqual([
      expect.objectContaining({ id: 'a', selected: true, draggable: true }),
      expect.objectContaining({ id: 'b', selected: true, draggable: true }),
    ])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: true }),
    ])
  })

  it('clears authoritative selected ids and the projected React Flow selection together', () => {
    const { result } = renderHook(() => useCanvasSelectionController())

    act(() => {
      result.current.replaceNodes(['a'])
    })

    expect(result.current.getSelectedNodeIds()).toEqual(['a'])
    expect(result.current.getSelectedEdgeIds()).toEqual([])
    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual(['a'])
    expect(useCanvasSelectionState.getState().selectedEdgeIds).toEqual([])

    act(() => {
      result.current.clear()
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual([])
    expect(useCanvasSelectionState.getState().selectedEdgeIds).toEqual([])
    expect(reactFlowMock.getNodes()).toEqual([
      expect.objectContaining({ id: 'a', selected: false, draggable: false }),
      expect.objectContaining({ id: 'b', selected: false, draggable: false }),
    ])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: false }),
    ])
  })

  it('tracks unknown ids without projecting selection onto React Flow nodes or edges', () => {
    const { result } = renderHook(() => useCanvasSelectionController())

    act(() => {
      result.current.replaceNodes(['z'])
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual(['z'])
    expect(useCanvasSelectionState.getState().selectedEdgeIds).toEqual([])
    expect(reactFlowMock.getNodes()).toEqual([
      expect.objectContaining({ id: 'a', selected: false, draggable: false }),
      expect.objectContaining({ id: 'b', selected: false, draggable: false }),
    ])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: false }),
    ])
  })

  it('keeps the projected selection empty when clear runs with nothing selected', () => {
    const { result } = renderHook(() => useCanvasSelectionController())

    act(() => {
      result.current.clear()
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual([])
    expect(useCanvasSelectionState.getState().selectedEdgeIds).toEqual([])
    expect(reactFlowMock.getNodes()).toEqual([
      expect.objectContaining({ id: 'a', selected: false, draggable: false }),
      expect.objectContaining({ id: 'b', selected: false, draggable: false }),
    ])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: false }),
    ])
  })

  it('does not select edges when only nodes are selected', () => {
    const { result } = renderHook(() => useCanvasSelectionController())

    act(() => {
      result.current.replaceNodes(['a'])
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual(['a'])
    expect(useCanvasSelectionState.getState().selectedEdgeIds).toEqual([])
    expect(reactFlowMock.getNodes()).toEqual([
      expect.objectContaining({ id: 'a', selected: true, draggable: true }),
      expect.objectContaining({ id: 'b', selected: false, draggable: false }),
    ])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: false }),
    ])
  })

  it('updates node toggle selection synchronously and keeps gesture activity derived', () => {
    const { result } = renderHook(() => ({
      selection: useCanvasSelectionController(),
      isGestureActive: useIsCanvasSelectionGestureActive(),
    }))

    act(() => {
      result.current.selection.beginGesture('marquee')
    })
    expect(result.current.isGestureActive).toBe(true)

    act(() => {
      result.current.selection.endGesture()
    })
    expect(result.current.isGestureActive).toBe(false)

    act(() => {
      result.current.selection.toggleNodeFromTarget('a', false)
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual(['a'])
  })

  it('supports edge-only selection snapshots and edge toggle selection', () => {
    const { result } = renderHook(() => useCanvasSelectionController())

    act(() => {
      result.current.replaceEdges(['e-a-b'])
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual([])
    expect(useCanvasSelectionState.getState().selectedEdgeIds).toEqual(['e-a-b'])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: true }),
    ])

    act(() => {
      result.current.toggleEdgeFromTarget('e-a-b', true)
    })

    expect(useCanvasSelectionState.getState().selectedEdgeIds).toEqual([])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: false }),
    ])
  })

  it('unions committed gesture selection with the existing committed ids in additive mode', () => {
    const { result } = renderHook(() => useCanvasSelectionController())

    act(() => {
      result.current.replace({ nodeIds: ['a'], edgeIds: [] })
      result.current.commitGestureSelection({ nodeIds: ['b'], edgeIds: ['e-a-b'] }, 'add')
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual(['a', 'b'])
    expect(useCanvasSelectionState.getState().selectedEdgeIds).toEqual(['e-a-b'])
    expect(reactFlowMock.getNodes()).toEqual([
      expect.objectContaining({ id: 'a', selected: true, draggable: true }),
      expect.objectContaining({ id: 'b', selected: true, draggable: true }),
    ])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: true }),
    ])
  })
})
