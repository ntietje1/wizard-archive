import { describe, expect, it, vi } from 'vitest'
import { selectToolModule } from '../select-tool-module'
import type { CanvasToolContextById } from '../canvas-tool-types'
import type { Node } from '@xyflow/react'

function createMouseEvent(
  x: number,
  y: number,
  overrides: Partial<React.MouseEvent> = {},
): React.MouseEvent {
  return {
    clientX: x,
    clientY: y,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: {},
    ...overrides,
  } as React.MouseEvent
}

function createStrokeNode(id: string): Node {
  return {
    id,
    type: 'stroke',
    position: { x: 0, y: 0 },
    width: 100,
    height: 20,
    data: {
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      points: [
        [0, 10, 0.5],
        [100, 10, 0.5],
      ],
      size: 4,
    },
  }
}

describe('selectToolModule', () => {
  it('preserves multi-selection on modifier-click empty canvas', async () => {
    const setNodeSelection = vi.fn()
    const controller = selectToolModule.create({
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
      getNodes: () => [],
      getEdges: () => [],
      getSelectionSnapshot: () => ['a', 'b'],
      setNodeSelection,
      clearSelection: vi.fn(),
    } satisfies CanvasToolContextById['select'])

    controller.onPaneClick?.(createMouseEvent(500, 500, { ctrlKey: true }))
    await Promise.resolve()

    expect(setNodeSelection).toHaveBeenCalledWith(['a', 'b'])
  })

  it('uses the same padded stroke hit test for modifier deselection as for selection', async () => {
    const setNodeSelection = vi.fn()
    const strokeNode = createStrokeNode('stroke-1')
    const controller = selectToolModule.create({
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
      getNodes: () => [strokeNode],
      getEdges: () => [],
      getSelectionSnapshot: () => ['stroke-1', 'embed-1'],
      setNodeSelection,
      clearSelection: vi.fn(),
    } satisfies CanvasToolContextById['select'])

    controller.onPaneClick?.(createMouseEvent(50, 20, { ctrlKey: true }))
    await Promise.resolve()

    expect(setNodeSelection).toHaveBeenCalledWith(['embed-1'])
  })

  it('routes regular node ctrl-click through strict toggle behavior', async () => {
    const setNodeSelection = vi.fn()
    const clickedNode = {
      id: 'c',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node
    const controller = selectToolModule.create({
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
      getNodes: () => [clickedNode],
      getEdges: () => [],
      getSelectionSnapshot: () => ['a', 'b'],
      setNodeSelection,
      clearSelection: vi.fn(),
    } satisfies CanvasToolContextById['select'])

    controller.onNodeClick?.(createMouseEvent(0, 0, { ctrlKey: true }), clickedNode)
    await Promise.resolve()

    expect(setNodeSelection).toHaveBeenCalledWith(['a', 'b', 'c'])
  })
})
