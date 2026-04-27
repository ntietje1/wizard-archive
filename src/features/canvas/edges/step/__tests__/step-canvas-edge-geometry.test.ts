import { describe, expect, it } from 'vitest'
import {
  buildStepCanvasEdgeGeometryFromEdge,
  buildStepCanvasEdgeGeometryFromRenderProps,
} from '../step-canvas-edge-geometry'
import { CANVAS_HANDLE_POSITION } from '~/features/canvas/types/canvas-domain-types'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'

describe('buildStepCanvasEdgeGeometryFromRenderProps', () => {
  it('splits the middle run when bottom-to-top handles face away from each other', () => {
    const geometry = buildStepCanvasEdgeGeometryFromRenderProps({
      sourceX: 100,
      sourceY: 150,
      targetX: 300,
      targetY: 130,
      sourcePosition: CANVAS_HANDLE_POSITION.Bottom,
      targetPosition: CANVAS_HANDLE_POSITION.Top,
    })

    expect(geometry.points).toEqual([
      { x: 100, y: 150 },
      { x: 100, y: 198 },
      { x: 200, y: 198 },
      { x: 200, y: 82 },
      { x: 300, y: 82 },
      { x: 300, y: 130 },
    ])
  })

  it('splits before the nodes cross when the minimum stubs would overlap', () => {
    const geometry = buildStepCanvasEdgeGeometryFromRenderProps({
      sourceX: 100,
      sourceY: 150,
      targetX: 300,
      targetY: 190,
      sourcePosition: CANVAS_HANDLE_POSITION.Bottom,
      targetPosition: CANVAS_HANDLE_POSITION.Top,
    })

    expect(geometry.points).toEqual([
      { x: 100, y: 150 },
      { x: 100, y: 198 },
      { x: 200, y: 198 },
      { x: 200, y: 142 },
      { x: 300, y: 142 },
      { x: 300, y: 190 },
    ])
  })

  it('keeps the minimum stubs and a single middle run when vertical handles have room', () => {
    const geometry = buildStepCanvasEdgeGeometryFromRenderProps({
      sourceX: 100,
      sourceY: 150,
      targetX: 300,
      targetY: 250,
      sourcePosition: CANVAS_HANDLE_POSITION.Bottom,
      targetPosition: CANVAS_HANDLE_POSITION.Top,
    })

    expect(geometry.points).toEqual([
      { x: 100, y: 150 },
      { x: 100, y: 198 },
      { x: 100, y: 200 },
      { x: 300, y: 200 },
      { x: 300, y: 202 },
      { x: 300, y: 250 },
    ])
  })
})

describe('buildStepCanvasEdgeGeometryFromEdge', () => {
  it('positions the split using the midpoint between the closest node edges', () => {
    const sourceNode: Node = {
      id: 'source',
      type: 'text',
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      data: {},
    }
    const targetNode: Node = {
      id: 'target',
      type: 'text',
      position: { x: 300, y: 0 },
      width: 100,
      height: 100,
      data: {},
    }
    const edge: Edge = {
      id: 'edge-1',
      type: 'step',
      source: 'source',
      target: 'target',
      sourceHandle: 'bottom',
      targetHandle: 'top',
    }

    const geometry = buildStepCanvasEdgeGeometryFromEdge(
      edge,
      new Map([
        [sourceNode.id, sourceNode],
        [targetNode.id, targetNode],
      ]),
    )

    expect(geometry).not.toBeNull()
    expect(geometry!.points).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 148 },
      { x: 250, y: 148 },
      { x: 250, y: -48 },
      { x: 350, y: -48 },
      { x: 350, y: 0 },
    ])
  })

  it('relaxes the minimum stubs when the split column would land inside a node', () => {
    const sourceNode: Node = {
      id: 'source',
      type: 'text',
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      data: {},
    }
    const targetNode: Node = {
      id: 'target',
      type: 'text',
      position: { x: 180, y: 0 },
      width: 100,
      height: 100,
      data: {},
    }
    const edge: Edge = {
      id: 'edge-2',
      type: 'step',
      source: 'source',
      target: 'target',
      sourceHandle: 'bottom',
      targetHandle: 'top',
    }

    const geometry = buildStepCanvasEdgeGeometryFromEdge(
      edge,
      new Map([
        [sourceNode.id, sourceNode],
        [targetNode.id, targetNode],
      ]),
    )

    expect(geometry).not.toBeNull()
    expect(geometry!.points).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 50 },
      { x: 230, y: 50 },
      { x: 230, y: 0 },
    ])
  })
})
