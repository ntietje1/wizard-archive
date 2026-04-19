import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasSelectionActions } from '../use-canvas-selection-actions'
import { useCanvasSelectionState } from '../use-canvas-selection-state'
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

describe('useCanvasSelectionActions', () => {
  beforeEach(() => {
    reactFlowMock.reset()
    useCanvasSelectionState.getState().reset()
  })

  it('sets authoritative selected ids and projects them onto React Flow nodes and edges', () => {
    const { result } = renderHook(() => useCanvasSelectionActions())

    act(() => {
      result.current.setNodeSelection(['a', 'b'])
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual(['a', 'b'])
    expect(reactFlowMock.getNodes()).toEqual([
      expect.objectContaining({ id: 'a', selected: true, draggable: true }),
      expect.objectContaining({ id: 'b', selected: true, draggable: true }),
    ])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: true }),
    ])
  })

  it('clears authoritative selected ids and the projected React Flow selection together', () => {
    const { result } = renderHook(() => useCanvasSelectionActions())

    act(() => {
      result.current.setNodeSelection(['a'])
    })

    expect(result.current.getSelectedNodeIds()).toEqual(['a'])
    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual(['a'])

    act(() => {
      result.current.clearSelection()
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual([])
    expect(reactFlowMock.getNodes()).toEqual([
      expect.objectContaining({ id: 'a', selected: false, draggable: false }),
      expect.objectContaining({ id: 'b', selected: false, draggable: false }),
    ])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: false }),
    ])
  })

  it('tracks unknown ids without projecting selection onto React Flow nodes or edges', () => {
    const { result } = renderHook(() => useCanvasSelectionActions())

    act(() => {
      result.current.setNodeSelection(['z'])
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual(['z'])
    expect(reactFlowMock.getNodes()).toEqual([
      expect.objectContaining({ id: 'a', selected: false, draggable: false }),
      expect.objectContaining({ id: 'b', selected: false, draggable: false }),
    ])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: false }),
    ])
  })

  it('keeps the projected selection empty when clearSelection runs with nothing selected', () => {
    const { result } = renderHook(() => useCanvasSelectionActions())

    act(() => {
      result.current.clearSelection()
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual([])
    expect(reactFlowMock.getNodes()).toEqual([
      expect.objectContaining({ id: 'a', selected: false, draggable: false }),
      expect.objectContaining({ id: 'b', selected: false, draggable: false }),
    ])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: false }),
    ])
  })

  it('does not select edges when only one endpoint node is selected', () => {
    const { result } = renderHook(() => useCanvasSelectionActions())

    act(() => {
      result.current.setNodeSelection(['a'])
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual(['a'])
    expect(reactFlowMock.getNodes()).toEqual([
      expect.objectContaining({ id: 'a', selected: true, draggable: true }),
      expect.objectContaining({ id: 'b', selected: false, draggable: false }),
    ])
    expect(reactFlowMock.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-a-b', selected: false }),
    ])
  })
})
