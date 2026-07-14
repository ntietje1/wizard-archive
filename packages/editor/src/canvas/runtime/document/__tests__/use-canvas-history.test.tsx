import { act, renderHook } from '@testing-library/react'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { useCanvasHistory } from '../use-canvas-history'
import type { RenderHookResult } from '@testing-library/react'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'
type TextNode = Extract<Node, { type: 'text' }>

function textContent(text: string): TextNode['data']['content'] {
  return [{ type: 'paragraph', content: [{ type: 'text', text }] }]
}

function createNode(id: string): TextNode {
  return {
    id: testCanvasNodeId(id),
    type: 'text',
    position: { x: 0, y: 0 },
    data: { content: textContent(id) },
  }
}

describe('useCanvasHistory', () => {
  let docs: Array<Y.Doc>
  let hooks: Array<Pick<RenderHookResult<ReturnType<typeof useCanvasHistory>, unknown>, 'unmount'>>
  let selectionController: Pick<Parameters<typeof useCanvasHistory>[0]['selection'], 'setSelection'>

  beforeEach(() => {
    docs = []
    hooks = []
    selectionController = {
      setSelection: vi.fn(),
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
      hook.result.current.onSelectionChange({ nodeIds: new Set(['a']), edgeIds: new Set() })
      hook.result.current.onSelectionChange({
        nodeIds: new Set(['a', 'b']),
        edgeIds: new Set(['edge-1']),
      })
    })

    act(() => {
      hook.result.current.undo()
    })

    expect(selectionController.setSelection).toHaveBeenLastCalledWith({
      nodeIds: new Set(['a']),
      edgeIds: new Set(),
    })

    act(() => {
      hook.result.current.redo()
    })

    expect(selectionController.setSelection).toHaveBeenLastCalledWith({
      nodeIds: new Set(['a', 'b']),
      edgeIds: new Set(['edge-1']),
    })
  })

  it('does not let later caller mutations change stored selection history', () => {
    const doc = new Y.Doc()
    docs.push(doc)
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    const hook = renderHook(() =>
      useCanvasHistory({ nodesMap, edgesMap, selection: selectionController }),
    )
    hooks.push(hook)

    const firstSelection = { nodeIds: new Set(['a']), edgeIds: new Set<string>() }
    const secondSelection = { nodeIds: new Set(['b']), edgeIds: new Set<string>() }

    act(() => {
      hook.result.current.onSelectionChange(firstSelection)
      hook.result.current.onSelectionChange(secondSelection)
    })
    firstSelection.nodeIds.add('mutated-after-history')
    secondSelection.nodeIds.add('mutated-after-history')

    act(() => {
      hook.result.current.undo()
    })

    expect(selectionController.setSelection).toHaveBeenLastCalledWith({
      nodeIds: new Set(['a']),
      edgeIds: new Set<string>(),
    })
  })

  it('resets cached selection when the document maps change', () => {
    const firstDoc = new Y.Doc()
    const secondDoc = new Y.Doc()
    docs.push(firstDoc, secondDoc)

    const firstNodesMap = firstDoc.getMap<Node>('nodes')
    const firstEdgesMap = firstDoc.getMap<Edge>('edges')
    const secondNodesMap = secondDoc.getMap<Node>('nodes')
    const secondEdgesMap = secondDoc.getMap<Edge>('edges')

    const hook = renderHook(
      ({ nodesMap, edgesMap }: { nodesMap: Y.Map<Node>; edgesMap: Y.Map<Edge> }) =>
        useCanvasHistory({ nodesMap, edgesMap, selection: selectionController }),
      { initialProps: { nodesMap: firstNodesMap, edgesMap: firstEdgesMap } },
    )
    hooks.push(hook)

    act(() => {
      hook.result.current.onSelectionChange({
        nodeIds: new Set(['old-doc-node']),
        edgeIds: new Set<string>(),
      })
    })

    hook.rerender({ nodesMap: secondNodesMap, edgesMap: secondEdgesMap })

    act(() => {
      hook.result.current.onSelectionChange({
        nodeIds: new Set(['new-doc-node']),
        edgeIds: new Set<string>(),
      })
    })
    act(() => {
      hook.result.current.undo()
    })

    expect(selectionController.setSelection).toHaveBeenLastCalledWith({
      nodeIds: new Set<string>(),
      edgeIds: new Set<string>(),
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
          source: testCanvasNodeId('a'),
          target: testCanvasNodeId('b'),
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

  it('restores document-change selections across undo and redo transitions', async () => {
    const doc = new Y.Doc()
    docs.push(doc)
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    const hook = renderHook(() =>
      useCanvasHistory({ nodesMap, edgesMap, selection: selectionController }),
    )
    hooks.push(hook)

    act(() => {
      hook.result.current.onSelectionChange({
        nodeIds: new Set(['before-change']),
        edgeIds: new Set<string>(),
      })
      nodesMap.set('created-node', createNode('created-node'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      hook.result.current.onSelectionChange({
        nodeIds: new Set(['after-change']),
        edgeIds: new Set<string>(),
      })
    })

    act(() => {
      hook.result.current.undo()
    })
    expect(selectionController.setSelection).toHaveBeenLastCalledWith({
      nodeIds: new Set(['before-change']),
      edgeIds: new Set<string>(),
    })

    act(() => {
      hook.result.current.redo()
    })
    expect(selectionController.setSelection).toHaveBeenLastCalledWith({
      nodeIds: new Set(['after-change']),
      edgeIds: new Set<string>(),
    })
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
        nodesMap.set('a', { ...createNode('a'), data: { content: textContent('updated-a') } })
        nodesMap.set('b', { ...createNode('b'), data: { content: textContent('updated-b') } })
      })
    })

    expect(nodesMap.get('a')?.data).toMatchObject({ content: textContent('updated-a') })
    expect(nodesMap.get('b')?.data).toMatchObject({ content: textContent('updated-b') })

    act(() => {
      hook.result.current.undo()
    })

    expect(nodesMap.get('a')?.data).toMatchObject({ content: textContent('a') })
    expect(nodesMap.get('b')?.data).toMatchObject({ content: textContent('b') })
    expect(hook.result.current.canUndo).toBe(false)
    expect(hook.result.current.canRedo).toBe(true)
  })

  it('exposes only the retained document undo history', () => {
    const doc = new Y.Doc()
    docs.push(doc)
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    const hook = renderHook(() =>
      useCanvasHistory({ nodesMap, edgesMap, selection: selectionController }),
    )
    hooks.push(hook)

    for (let index = 0; index <= 100; index += 1) {
      act(() => {
        nodesMap.set(`node-${index}`, createNode(`node-${index}`))
      })
    }

    for (let index = 0; index < 100; index += 1) {
      act(() => {
        hook.result.current.undo()
      })
    }

    expect(Array.from(nodesMap.keys())).toEqual(['node-0'])
    expect(hook.result.current.canUndo).toBe(false)
  })
})
