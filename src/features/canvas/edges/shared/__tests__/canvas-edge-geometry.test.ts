import { describe, expect, it } from 'vitest'
import { getCanvasEdgeEndpoints } from '../canvas-edge-geometry'
import { CANVAS_HANDLE_POSITION } from '~/features/canvas/types/canvas-domain-types'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '~/features/canvas/types/canvas-domain-types'

describe('getCanvasEdgeEndpoints', () => {
  it('anchors stroke edges to the start and end stroke points instead of the bounding box', () => {
    const strokeNode = {
      id: 'stroke-1',
      type: 'stroke',
      position: { x: 10, y: 20 },
      width: 100,
      height: 20,
      data: {
        bounds: { x: 0, y: 0, width: 100, height: 20 },
        points: [
          [0, 10, 0.5],
          [100, 10, 0.5],
        ],
        color: 'var(--foreground)',
        size: 4,
      },
    } as unknown as Node
    const targetNode: Node = {
      id: 'target-1',
      type: 'text',
      position: { x: 200, y: 20 },
      width: 80,
      height: 60,
      data: {},
    }
    const nodeMap = new Map([
      [strokeNode.id, strokeNode],
      [targetNode.id, targetNode],
    ])

    const startEndpoints = getCanvasEdgeEndpoints(
      {
        id: 'edge-start',
        source: 'stroke-1',
        target: 'target-1',
        sourceHandle: 'start',
        targetHandle: 'left',
      } as Edge,
      nodeMap,
    )
    const endEndpoints = getCanvasEdgeEndpoints(
      {
        id: 'edge-end',
        source: 'stroke-1',
        target: 'target-1',
        sourceHandle: 'end',
        targetHandle: 'left',
      } as Edge,
      nodeMap,
    )

    expect(startEndpoints).toEqual({
      sourceX: 10,
      sourceY: 30,
      targetX: 200,
      targetY: 50,
      sourcePosition: CANVAS_HANDLE_POSITION.Left,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })
    expect(endEndpoints).toEqual({
      sourceX: 110,
      sourceY: 30,
      targetX: 200,
      targetY: 50,
      sourcePosition: CANVAS_HANDLE_POSITION.Right,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })
  })

  it('falls back to regular node anchors when stroke node data is malformed', () => {
    const strokeNode = {
      id: 'stroke-1',
      type: 'stroke',
      position: { x: 10, y: 20 },
      width: 100,
      height: 20,
      data: {
        bounds: { x: 0, y: 0, width: 100, height: 20 },
        points: [[0, 10, 'bad']],
        color: 'var(--foreground)',
        size: 4,
      },
    } as unknown as Node
    const targetNode: Node = {
      id: 'target-1',
      type: 'text',
      position: { x: 200, y: 20 },
      width: 80,
      height: 60,
      data: {},
    }
    const nodeMap = new Map([
      [strokeNode.id, strokeNode],
      [targetNode.id, targetNode],
    ])

    expect(
      getCanvasEdgeEndpoints(
        {
          id: 'edge-start',
          source: 'stroke-1',
          target: 'target-1',
          sourceHandle: 'start',
          targetHandle: 'left',
        } as Edge,
        nodeMap,
      ),
    ).toEqual({
      sourceX: 110,
      sourceY: 30,
      targetX: 200,
      targetY: 50,
      sourcePosition: CANVAS_HANDLE_POSITION.Right,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })
  })
})
