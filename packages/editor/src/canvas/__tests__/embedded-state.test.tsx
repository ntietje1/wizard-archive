import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { useEmbeddedCanvasStateFromUpdates } from '../embedded-state'
import type { SidebarItemId } from '../../../../../shared/common/ids'

describe('useEmbeddedCanvasStateFromUpdates', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads Yjs updates into local nodes and edges and settles after the initial empty response', async () => {
    const initialUpdate = createCanvasUpdate({
      nodes: [{ id: 'node-1', position: { x: 10, y: 20 }, data: {}, type: 'text' }],
      edges: [{ id: 'edge-1', source: 'node-1', target: 'node-1', type: 'bezier' }],
    })
    let currentResult = {
      data: [{ revision: 0, seq: 1, update: initialUpdate }],
      isError: false,
    }

    const { result, rerender } = renderHook(() =>
      useEmbeddedCanvasStateFromUpdates({
        canvasId: canvasId('canvas-1'),
        useUpdates: () => currentResult,
      }),
    )

    expect(result.current.status).toBe('loading')
    expect(result.current).not.toHaveProperty('nodes')
    expect(result.current).not.toHaveProperty('edges')

    currentResult = {
      data: [],
      isError: false,
    }
    rerender()

    await waitFor(() => {
      expect(result.current.status).toBe('available')
    })

    const available = requireAvailableEmbeddedCanvasState(result.current)
    expect(available.nodes[0]).toMatchObject({
      id: 'node-1',
      position: { x: 10, y: 20 },
    })
    expect(available.edges[0]).toMatchObject({
      id: 'edge-1',
      source: 'node-1',
      target: 'node-1',
    })
  })

  it('publishes same-id embedded canvas node and edge changes', async () => {
    const { initialUpdate, nextUpdate } = createCanvasUpdateSequence({
      initial: {
        nodes: [{ id: 'node-1', position: { x: 10, y: 20 }, data: {}, type: 'text' }],
        edges: [{ id: 'edge-1', source: 'node-1', target: 'node-1', type: 'bezier' }],
      },
      next: {
        nodes: [{ id: 'node-1', position: { x: 30, y: 40 }, data: {}, type: 'note' }],
        edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2', type: 'straight' }],
      },
    })
    let currentResult = {
      data: [{ revision: 0, seq: 1, update: initialUpdate }],
      isError: false,
    }

    const { result, rerender } = renderHook(() =>
      useEmbeddedCanvasStateFromUpdates({
        canvasId: canvasId('canvas-1'),
        useUpdates: () => currentResult,
      }),
    )

    currentResult = {
      data: [],
      isError: false,
    }
    rerender()

    await waitFor(() => {
      expect(result.current.status).toBe('available')
    })
    let available = requireAvailableEmbeddedCanvasState(result.current)
    expect(available.nodes[0]).toMatchObject({ id: 'node-1', position: { x: 10, y: 20 } })
    expect(available.edges[0]).toMatchObject({ id: 'edge-1', target: 'node-1' })

    currentResult = {
      data: [{ revision: 0, seq: 2, update: nextUpdate }],
      isError: false,
    }
    rerender()

    await waitFor(() => {
      expect(result.current.status).toBe('loading')
    })

    currentResult = {
      data: [],
      isError: false,
    }
    rerender()

    await waitFor(() => {
      const current = requireAvailableEmbeddedCanvasState(result.current)
      expect(current.nodes[0]).toMatchObject({
        id: 'node-1',
        position: { x: 30, y: 40 },
        type: 'note',
      })
      expect(current.edges[0]).toMatchObject({
        id: 'edge-1',
        target: 'node-2',
        type: 'straight',
      })
    })
  })

  it('exposes an error state when the embedded canvas update source fails', () => {
    const { result } = renderHook(() =>
      useEmbeddedCanvasStateFromUpdates({
        canvasId: canvasId('canvas-1'),
        useUpdates: () => ({ data: undefined, isError: true }),
      }),
    )

    expect(result.current.status).toBe('unavailable')
    expect(result.current).not.toHaveProperty('nodes')
    expect(result.current).not.toHaveProperty('edges')
  })

  it('destroys the local Y.Doc when the hook unmounts', () => {
    const destroySpy = vi.spyOn(Y.Doc.prototype, 'destroy')

    const { unmount } = renderHook(() =>
      useEmbeddedCanvasStateFromUpdates({
        canvasId: canvasId('canvas-1'),
        useUpdates: () => ({ data: [], isError: false }),
      }),
    )

    unmount()

    expect(destroySpy).toHaveBeenCalled()
  })

  it('resets local state when the embedded canvas id changes', async () => {
    const canvasOneUpdate = createCanvasUpdate({
      nodes: [{ id: 'node-1', position: { x: 10, y: 20 }, data: {}, type: 'text' }],
      edges: [],
    })
    const canvasTwoUpdate = createCanvasUpdate({
      nodes: [{ id: 'node-2', position: { x: 30, y: 40 }, data: {}, type: 'text' }],
      edges: [],
    })
    let currentResult = {
      data: [{ revision: 0, seq: 1, update: canvasOneUpdate }],
      isError: false,
    }
    const updateRequests: Array<{
      afterSeq: number | undefined
      canvasId: SidebarItemId
    }> = []

    const { result, rerender } = renderHook(
      ({ currentCanvasId }) =>
        useEmbeddedCanvasStateFromUpdates({
          canvasId: currentCanvasId,
          useUpdates: (request) => {
            updateRequests.push(request)
            return currentResult
          },
        }),
      {
        initialProps: { currentCanvasId: canvasId('canvas-1') },
      },
    )

    currentResult = {
      data: [],
      isError: false,
    }
    rerender({ currentCanvasId: canvasId('canvas-1') })

    await waitFor(() => expect(result.current.status).toBe('available'))
    expect(requireAvailableEmbeddedCanvasState(result.current).nodes[0]?.id).toBe('node-1')

    currentResult = {
      data: [],
      isError: false,
    }
    rerender({ currentCanvasId: canvasId('canvas-2') })

    await waitFor(() => {
      expect(updateRequests).toContainEqual({
        canvasId: canvasId('canvas-2'),
        afterSeq: undefined,
      })
    })

    await waitFor(() => {
      const current = requireAvailableEmbeddedCanvasState(result.current)
      expect(current.nodes).toEqual([])
      expect(current.edges).toEqual([])
    })

    currentResult = {
      data: [{ revision: 0, seq: 1, update: canvasTwoUpdate }],
      isError: false,
    }
    rerender({ currentCanvasId: canvasId('canvas-2') })

    await waitFor(() => {
      expect(result.current.status).toBe('loading')
    })

    currentResult = {
      data: [],
      isError: false,
    }
    rerender({ currentCanvasId: canvasId('canvas-2') })

    await waitFor(() => {
      const current = requireAvailableEmbeddedCanvasState(result.current)
      expect(current.nodes).toEqual([
        expect.objectContaining({ id: 'node-2', position: { x: 30, y: 40 } }),
      ])
    })
  })
})

function createCanvasUpdate({ nodes, edges }: { nodes: Array<TestNode>; edges: Array<TestEdge> }) {
  const doc = new Y.Doc()
  const nodesMap = doc.getMap('nodes')
  const edgesMap = doc.getMap('edges')

  for (const node of nodes) {
    nodesMap.set(String(node.id), node)
  }

  for (const edge of edges) {
    edgesMap.set(String(edge.id), edge)
  }

  const update = Y.encodeStateAsUpdate(doc)
  doc.destroy()
  return update
}

function createCanvasUpdateSequence({
  initial,
  next,
}: {
  initial: { nodes: Array<TestNode>; edges: Array<TestEdge> }
  next: { nodes: Array<TestNode>; edges: Array<TestEdge> }
}) {
  const doc = new Y.Doc()
  const nodesMap = doc.getMap('nodes')
  const edgesMap = doc.getMap('edges')

  for (const node of initial.nodes) {
    nodesMap.set(String(node.id), node)
  }
  for (const edge of initial.edges) {
    edgesMap.set(String(edge.id), edge)
  }
  const initialUpdate = Y.encodeStateAsUpdate(doc)

  for (const node of next.nodes) {
    nodesMap.set(String(node.id), node)
  }
  for (const edge of next.edges) {
    edgesMap.set(String(edge.id), edge)
  }
  const nextUpdate = Y.encodeStateAsUpdate(doc)
  doc.destroy()

  return { initialUpdate, nextUpdate }
}

interface TestNode {
  id: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  type: string
}

interface TestEdge {
  id: string
  source: string
  target: string
  type: string
}

function requireAvailableEmbeddedCanvasState(
  state: ReturnType<typeof useEmbeddedCanvasStateFromUpdates>,
): Extract<ReturnType<typeof useEmbeddedCanvasStateFromUpdates>, { status: 'available' }> {
  expect(state.status).toBe('available')
  if (state.status !== 'available') {
    throw new Error(`Expected available embedded canvas state, received ${state.status}`)
  }
  return state
}

function canvasId(value: string): SidebarItemId {
  return value as SidebarItemId
}
