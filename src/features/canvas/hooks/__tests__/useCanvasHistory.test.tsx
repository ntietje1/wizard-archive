import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useCanvasHistory } from '../useCanvasHistory'
import type { RenderHookResult } from '@testing-library/react'
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
  let docs: Array<Y.Doc>
  let hooks: Array<RenderHookResult<ReturnType<typeof useCanvasHistory>, unknown>>

  beforeEach(() => {
    docs = []
    hooks = []
    reactFlowMock.reset()
  })

  afterEach(() => {
    for (const hook of hooks) {
      hook.unmount()
    }
    for (const doc of docs) {
      doc.destroy()
    }
  })

  it('keeps a redone change separate from the next user edit', () => {
    const doc = new Y.Doc()
    docs.push(doc)
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    const hook = renderHook(() => useCanvasHistory({ nodesMap, edgesMap }))
    hooks.push(hook)

    act(() => {
      nodesMap.set('a', createNode('a'))
    })
    act(() => {
      nodesMap.set('b', createNode('b'))
    })

    act(() => {
      hook.result.current.undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a'])

    act(() => {
      hook.result.current.redo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b'])

    act(() => {
      nodesMap.set('c', createNode('c'))
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b', 'c'])

    act(() => {
      hook.result.current.undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b'])

    act(() => {
      hook.result.current.undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a'])
  })

  it('keeps consecutive redos as separate undo entries', () => {
    const doc = new Y.Doc()
    docs.push(doc)
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    const hook = renderHook(() => useCanvasHistory({ nodesMap, edgesMap }))
    hooks.push(hook)

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
      hook.result.current.undo()
    })
    act(() => {
      hook.result.current.undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a'])

    act(() => {
      hook.result.current.redo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b'])

    act(() => {
      hook.result.current.redo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b', 'c'])

    act(() => {
      hook.result.current.undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a', 'b'])

    act(() => {
      hook.result.current.undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual(['a'])
  })

  it('keeps canUndo and canRedo aligned with the actual stacks', () => {
    const doc = new Y.Doc()
    docs.push(doc)
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    const hook = renderHook(() => useCanvasHistory({ nodesMap, edgesMap }))
    hooks.push(hook)

    expect(hook.result.current.canUndo).toBe(false)
    expect(hook.result.current.canRedo).toBe(false)

    act(() => {
      nodesMap.set('a', createNode('a'))
    })
    expect(hook.result.current.canUndo).toBe(true)
    expect(hook.result.current.canRedo).toBe(false)

    act(() => {
      hook.result.current.undo()
    })
    expect(hook.result.current.canUndo).toBe(false)
    expect(hook.result.current.canRedo).toBe(true)

    act(() => {
      hook.result.current.redo()
    })
    expect(hook.result.current.canUndo).toBe(true)
    expect(hook.result.current.canRedo).toBe(false)
  })
})
