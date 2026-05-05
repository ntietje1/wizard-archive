import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { parseEmbeddedCanvasStableId } from 'convex/canvases/validation'
import { useEmbeddedCanvasState } from '../use-embedded-canvas-state'
import { testId } from '~/test/helpers/test-id'

const useCampaignQueryMock = vi.hoisted(() => vi.fn())

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

describe('useEmbeddedCanvasState', () => {
  afterEach(() => {
    useCampaignQueryMock.mockReset()
  })

  it('loads Yjs updates into local nodes and edges and settles after the initial empty response', async () => {
    const initialUpdate = createCanvasUpdate({
      nodes: [{ id: 'node-1', position: { x: 10, y: 20 }, data: {}, type: 'text' }],
      edges: [{ id: 'edge-1', source: 'node-1', target: 'node-1', type: 'bezier' }],
    })

    let currentResult = {
      data: [{ seq: 1, update: initialUpdate }],
      isError: false,
    }

    useCampaignQueryMock.mockImplementation(() => currentResult)

    const { result, rerender } = renderHook(() =>
      useEmbeddedCanvasState(createTestCanvasId('canvas-1')),
    )

    await waitFor(() => {
      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.edges).toHaveLength(1)
    })

    expect(result.current.isLoading).toBe(true)

    currentResult = {
      data: [],
      isError: false,
    }
    rerender()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.nodes[0]).toMatchObject({
      id: 'node-1',
      position: { x: 10, y: 20 },
    })
    expect(result.current.edges[0]).toMatchObject({
      id: 'edge-1',
      source: 'node-1',
      target: 'node-1',
    })
  })

  it('exposes an error state when the embedded canvas query fails', () => {
    useCampaignQueryMock.mockReturnValue({
      data: undefined,
      isError: true,
    })

    const { result } = renderHook(() => useEmbeddedCanvasState(createTestCanvasId('canvas-1')))

    expect(result.current.isError).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.nodes).toEqual([])
    expect(result.current.edges).toEqual([])
  })

  it('destroys the local Y.Doc when the hook unmounts', () => {
    useCampaignQueryMock.mockReturnValue({
      data: [],
      isError: false,
    })
    const destroySpy = vi.spyOn(Y.Doc.prototype, 'destroy')

    const { unmount } = renderHook(() => useEmbeddedCanvasState(createTestCanvasId('canvas-1')))

    unmount()

    expect(destroySpy).toHaveBeenCalled()
    destroySpy.mockRestore()
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
      data: [{ seq: 1, update: canvasOneUpdate }],
      isError: false,
    }

    useCampaignQueryMock.mockImplementation(() => currentResult)

    const { result, rerender } = renderHook(({ canvasId }) => useEmbeddedCanvasState(canvasId), {
      initialProps: { canvasId: createTestCanvasId('canvas-1') },
    })

    await waitFor(() => {
      expect(result.current.nodes[0]?.id).toBe('node-1')
    })

    currentResult = {
      data: [{ seq: 1, update: canvasTwoUpdate }],
      isError: false,
    }
    rerender({ canvasId: createTestCanvasId('canvas-2') })

    await waitFor(() => {
      expect(result.current.nodes).toEqual([
        expect.objectContaining({ id: 'node-2', position: { x: 30, y: 40 } }),
      ])
    })
  })
})

describe('parseEmbeddedCanvasStableId', () => {
  it('rejects malformed stable ids safely', () => {
    expect(parseEmbeddedCanvasStableId({ id: 'node-1' })).toBe('node-1')
    expect(parseEmbeddedCanvasStableId(null)).toBeUndefined()
    expect(parseEmbeddedCanvasStableId(undefined)).toBeUndefined()
    expect(parseEmbeddedCanvasStableId({})).toBeUndefined()
    expect(parseEmbeddedCanvasStableId({ foo: 'bar' })).toBeUndefined()
    expect(parseEmbeddedCanvasStableId({ id: null })).toBeUndefined()
    expect(parseEmbeddedCanvasStableId({ id: '' })).toBeUndefined()
    expect(parseEmbeddedCanvasStableId({ id: 42 })).toBeUndefined()
    expect(parseEmbeddedCanvasStableId('node-1')).toBeUndefined()
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

function createTestCanvasId(value: string) {
  return testId<'sidebarItems'>(value)
}
