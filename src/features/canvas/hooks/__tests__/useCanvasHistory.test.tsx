import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useCanvasHistory } from '../useCanvasHistory'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import type { Edge, Node } from '@xyflow/react'

const reactFlowMock = vi.hoisted(() => {
  let nodes: Array<Node> = []

  return {
    get nodes() {
      return nodes
    },
    reset() {
      nodes = []
    },
    setNodes(updater: (nodes: Array<Node>) => Array<Node>) {
      nodes = updater(nodes)
    },
  }
})

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
}))

function createNode(id: string): Node {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0 },
    data: { label: id },
  } as Node
}

describe('useCanvasHistory', () => {
  beforeEach(() => {
    reactFlowMock.reset()
    useCanvasToolStore.getState().reset()
  })

  it('keeps a redone change separate from the next user edit', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    renderHook(() => useCanvasHistory({ nodesMap, edgesMap }))

    act(() => {
      nodesMap.set('a', createNode('a'))
    })
    act(() => {
      nodesMap.set('b', createNode('b'))
    })

    act(() => {
      useCanvasToolStore.getState().undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a'])

    act(() => {
      useCanvasToolStore.getState().redo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b'])

    act(() => {
      nodesMap.set('c', createNode('c'))
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b', 'c'])

    act(() => {
      useCanvasToolStore.getState().undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b'])

    act(() => {
      useCanvasToolStore.getState().undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a'])
  })

  it('keeps consecutive redos as separate undo entries', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    renderHook(() => useCanvasHistory({ nodesMap, edgesMap }))

    act(() => {
      nodesMap.set('a', createNode('a'))
    })
    act(() => {
      nodesMap.set('b', createNode('b'))
    })
    act(() => {
      nodesMap.set('c', createNode('c'))
    })

    act(() => {
      useCanvasToolStore.getState().undo()
      useCanvasToolStore.getState().undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a'])

    act(() => {
      useCanvasToolStore.getState().redo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b'])

    act(() => {
      useCanvasToolStore.getState().redo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b', 'c'])

    act(() => {
      useCanvasToolStore.getState().undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b'])

    act(() => {
      useCanvasToolStore.getState().undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a'])
  })
})
