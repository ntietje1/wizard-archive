import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useCanvasHistory } from '../use-canvas-history'
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
  let selectionController: Pick<Parameters<typeof useCanvasHistory>[0]['selection'], 'replace'>

  beforeEach(() => {
    docs = []
    hooks = []
    reactFlowMock.reset()
    selectionController = {
      replace: vi.fn(),
    }
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

    const hook = renderHook(() =>
      useCanvasHistory({ nodesMap, edgesMap, selection: selectionController }),
    )
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

    const hook = renderHook(() =>
      useCanvasHistory({ nodesMap, edgesMap, selection: selectionController }),
    )
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

    const hook = renderHook(() =>
      useCanvasHistory({ nodesMap, edgesMap, selection: selectionController }),
    )
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
      nodesMap.set('b', createNode('b'))
    })
    expect(Array.from(nodesMap.keys())).toEqual(['b'])
    expect(hook.result.current.canUndo).toBe(true)
    expect(hook.result.current.canRedo).toBe(false)

    act(() => {
      hook.result.current.undo()
    })
    expect(Array.from(nodesMap.keys())).toEqual([])
    expect(hook.result.current.canUndo).toBe(false)
    expect(hook.result.current.canRedo).toBe(true)

    act(() => {
      hook.result.current.redo()
    })
    expect(hook.result.current.canUndo).toBe(true)
    expect(hook.result.current.canRedo).toBe(false)
  })

  it('restores selection through the authoritative selection controller during undo and redo', () => {
    const doc = new Y.Doc()
    docs.push(doc)
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    const hook = renderHook(() =>
      useCanvasHistory({ nodesMap, edgesMap, selection: selectionController }),
    )
    hooks.push(hook)

    act(() => {
      hook.result.current.onSelectionChange({ nodeIds: ['a'], edgeIds: [] })
      hook.result.current.onSelectionChange({ nodeIds: ['a', 'b'], edgeIds: ['edge-1'] })
    })

    act(() => {
      hook.result.current.undo()
    })

    expect(selectionController.replace).toHaveBeenLastCalledWith({ nodeIds: ['a'], edgeIds: [] })

    act(() => {
      hook.result.current.redo()
    })

    expect(selectionController.replace).toHaveBeenLastCalledWith({
      nodeIds: ['a', 'b'],
      edgeIds: ['edge-1'],
    })
  })

  it('restores connected edges when a node deletion removed both in one document change', () => {
    const doc = new Y.Doc()
    docs.push(doc)
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    const hook = renderHook(() =>
      useCanvasHistory({ nodesMap, edgesMap, selection: selectionController }),
    )
    hooks.push(hook)

    act(() => {
      doc.transact(() => {
        nodesMap.set('a', createNode('a'))
        nodesMap.set('b', createNode('b'))
        edgesMap.set('edge-1', {
          id: 'edge-1',
          type: 'bezier',
          source: 'a',
          target: 'b',
        })
      })
    })

    act(() => {
      doc.transact(() => {
        edgesMap.delete('edge-1')
        nodesMap.delete('a')
      })
    })

    expect(nodesMap.has('a')).toBe(false)
    expect(edgesMap.has('edge-1')).toBe(false)

    act(() => {
      hook.result.current.undo()
    })

    expect(nodesMap.has('a')).toBe(true)
    expect(edgesMap.has('edge-1')).toBe(true)
  })

  it('undoes a batched multi-node update in a single step', () => {
    const doc = new Y.Doc()
    docs.push(doc)
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    nodesMap.set('a', createNode('a'))
    nodesMap.set('b', createNode('b'))

    const hook = renderHook(() =>
      useCanvasHistory({ nodesMap, edgesMap, selection: selectionController }),
    )
    hooks.push(hook)

    act(() => {
      doc.transact(() => {
        nodesMap.set('a', { ...createNode('a'), data: { label: 'updated-a' } })
        nodesMap.set('b', { ...createNode('b'), data: { label: 'updated-b' } })
      })
    })

    expect(nodesMap.get('a')?.data).toMatchObject({ label: 'updated-a' })
    expect(nodesMap.get('b')?.data).toMatchObject({ label: 'updated-b' })

    act(() => {
      hook.result.current.undo()
    })

    expect(nodesMap.get('a')?.data).toMatchObject({ label: 'a' })
    expect(nodesMap.get('b')?.data).toMatchObject({ label: 'b' })
    expect(hook.result.current.canUndo).toBe(false)
    expect(hook.result.current.canRedo).toBe(true)
  })
})
