import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useCanvasPlacementTool } from '../useCanvasPlacementTool'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import {
  STICKY_DEFAULT_COLOR,
  STICKY_DEFAULT_HEIGHT,
  STICKY_DEFAULT_OPACITY,
  STICKY_DEFAULT_WIDTH,
  TEXT_NODE_DEFAULT_HEIGHT,
  TEXT_NODE_DEFAULT_WIDTH,
} from '../../components/nodes/sticky-node-constants'
import type { Node } from '@xyflow/react'

const reactFlowMock = vi.hoisted(() => ({
  screenToFlowPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
}))

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
}))

describe('useCanvasPlacementTool', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    reactFlowMock.screenToFlowPosition.mockImplementation(({ x, y }: { x: number; y: number }) => ({
      x,
      y,
    }))
  })

  it('places a text node, requests editing, and returns to pointer', () => {
    const setPendingEditNodeId = vi.fn()
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    useCanvasToolStore.getState().setActiveTool('text')

    const { result } = renderHook(() =>
      useCanvasPlacementTool({
        nodesMap,
        type: 'text',
        setPendingEditNodeId,
      }),
    )

    act(() => {
      result.current({ clientX: 100, clientY: 200 } as React.MouseEvent)
    })

    const node = Array.from(nodesMap.values())[0]
    expect(node.type).toBe('text')
    expect(node.selected).toBe(true)
    expect(node.draggable).toBe(true)
    expect(node.width).toBe(TEXT_NODE_DEFAULT_WIDTH)
    expect(node.height).toBe(TEXT_NODE_DEFAULT_HEIGHT)
    expect(node.position).toEqual({
      x: 100 - TEXT_NODE_DEFAULT_WIDTH / 2,
      y: 200 - TEXT_NODE_DEFAULT_HEIGHT / 2,
    })
    expect(setPendingEditNodeId).toHaveBeenCalledWith(node.id)
    expect(useCanvasToolStore.getState().activeTool).toBe('select')
  })

  it('places a sticky note with default styling', () => {
    const setPendingEditNodeId = vi.fn()
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    useCanvasToolStore.getState().setActiveTool('sticky')

    const { result } = renderHook(() =>
      useCanvasPlacementTool({
        nodesMap,
        type: 'sticky',
        setPendingEditNodeId,
      }),
    )

    act(() => {
      result.current({ clientX: 40, clientY: 60 } as React.MouseEvent)
    })

    const node = Array.from(nodesMap.values())[0]
    expect(node.type).toBe('sticky')
    expect(node.width).toBe(STICKY_DEFAULT_WIDTH)
    expect(node.height).toBe(STICKY_DEFAULT_HEIGHT)
    expect(node.data).toMatchObject({
      color: STICKY_DEFAULT_COLOR,
      opacity: STICKY_DEFAULT_OPACITY,
      label: '',
    })
  })
})
