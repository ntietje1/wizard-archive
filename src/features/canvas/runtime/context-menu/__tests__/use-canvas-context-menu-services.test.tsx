import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useCanvasContextMenuServices } from '../use-canvas-context-menu-services'
import { useCanvasClipboardStore } from '../use-canvas-clipboard-store'
import type { Edge, Node } from '@xyflow/react'
import type { CanvasSelectionSnapshot } from '../../../tools/canvas-tool-types'

function createNode(id: string, x: number, zIndex: number): Node {
  return {
    id,
    type: 'text',
    position: { x, y: 0 },
    data: { label: id },
    width: 120,
    height: 36,
    zIndex,
  }
}

function createEdge(id: string, source: string, target: string, zIndex: number): Edge {
  return {
    id,
    type: 'bezier',
    source,
    target,
    zIndex,
  }
}

describe('useCanvasContextMenuServices', () => {
  beforeEach(() => {
    useCanvasClipboardStore.getState().setClipboard(null)
  })

  it('copies selected nodes with only fully-contained edges and pastes a new selected graph', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    const replace = vi.fn()

    nodesMap.set('node-1', createNode('node-1', 0, 1))
    nodesMap.set('node-2', createNode('node-2', 120, 2))
    nodesMap.set('node-3', createNode('node-3', 240, 3))
    edgesMap.set('edge-1', createEdge('edge-1', 'node-1', 'node-2', 1))
    edgesMap.set('edge-2', createEdge('edge-2', 'node-2', 'node-3', 2))

    const { result } = renderHook(() =>
      useCanvasContextMenuServices({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection: { replace, clear: vi.fn() },
      }),
    )

    const selection: CanvasSelectionSnapshot = {
      nodeIds: ['node-1', 'node-2'],
      edgeIds: [],
    }

    act(() => {
      expect(result.current.copySnapshot(selection)).toBe(true)
    })

    const clipboard = useCanvasClipboardStore.getState().clipboard
    expect(clipboard?.nodes).toHaveLength(2)
    expect(clipboard?.edges.map((edge) => edge.id)).toEqual(['edge-1'])

    let pastedSelection: CanvasSelectionSnapshot | null = null
    act(() => {
      pastedSelection = result.current.pasteClipboard()
    })

    expect(pastedSelection).not.toBeNull()
    if (!pastedSelection) {
      throw new Error('Expected pasted selection')
    }
    const pasted = pastedSelection as CanvasSelectionSnapshot

    expect(pasted.nodeIds).toHaveLength(2)
    expect(pasted.edgeIds).toHaveLength(1)
    expect(nodesMap.size).toBe(5)
    expect(edgesMap.size).toBe(3)
    expect(replace).toHaveBeenCalledWith(pasted)

    const pastedNodes = pasted.nodeIds.map((nodeId) => nodesMap.get(nodeId))
    expect(pastedNodes.map((node) => node?.position.x)).toEqual([32, 152])
    expect(edgesMap.get(pasted.edgeIds[0])?.source).toBe(pasted.nodeIds[0])
    expect(edgesMap.get(pasted.edgeIds[0])?.target).toBe(pasted.nodeIds[1])
  })

  it('deletes connected edges when removing selected nodes', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    const replace = vi.fn()
    const clear = vi.fn()

    nodesMap.set('node-1', createNode('node-1', 0, 1))
    nodesMap.set('node-2', createNode('node-2', 120, 2))
    edgesMap.set('edge-1', createEdge('edge-1', 'node-1', 'node-2', 1))

    const { result } = renderHook(() =>
      useCanvasContextMenuServices({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection: { replace, clear },
      }),
    )

    act(() => {
      expect(
        result.current.deleteSnapshot({
          nodeIds: ['node-1'],
          edgeIds: [],
        }),
      ).toBe(true)
    })

    expect(nodesMap.has('node-1')).toBe(false)
    expect(edgesMap.has('edge-1')).toBe(false)
    expect(clear).toHaveBeenCalled()
  })

  it('reorders selected nodes by updating persisted zIndex values', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    nodesMap.set('node-1', createNode('node-1', 0, 1))
    nodesMap.set('node-2', createNode('node-2', 120, 2))
    nodesMap.set('node-3', createNode('node-3', 240, 3))

    const { result } = renderHook(() =>
      useCanvasContextMenuServices({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection: { replace: vi.fn(), clear: vi.fn() },
      }),
    )

    act(() => {
      expect(
        result.current.reorderSnapshot(
          {
            nodeIds: ['node-1'],
            edgeIds: [],
          },
          'bringToFront',
        ),
      ).toBe(true)
    })

    expect(nodesMap.get('node-1')?.zIndex).toBe(3)
    expect(nodesMap.get('node-2')?.zIndex).toBe(1)
    expect(nodesMap.get('node-3')?.zIndex).toBe(2)
  })

  it('reorders selected nodes and edges together when the snapshot contains both', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    nodesMap.set('node-1', createNode('node-1', 0, 1))
    nodesMap.set('node-2', createNode('node-2', 120, 2))
    nodesMap.set('node-3', createNode('node-3', 240, 3))
    edgesMap.set('edge-1', createEdge('edge-1', 'node-1', 'node-2', 1))
    edgesMap.set('edge-2', createEdge('edge-2', 'node-2', 'node-3', 2))

    const { result } = renderHook(() =>
      useCanvasContextMenuServices({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection: { replace: vi.fn(), clear: vi.fn() },
      }),
    )

    act(() => {
      expect(
        result.current.reorderSnapshot(
          {
            nodeIds: ['node-1'],
            edgeIds: ['edge-1'],
          },
          'bringToFront',
        ),
      ).toBe(true)
    })

    expect(nodesMap.get('node-1')?.zIndex).toBe(3)
    expect(nodesMap.get('node-2')?.zIndex).toBe(1)
    expect(nodesMap.get('node-3')?.zIndex).toBe(2)
    expect(edgesMap.get('edge-1')?.zIndex).toBe(2)
    expect(edgesMap.get('edge-2')?.zIndex).toBe(1)
  })
})
