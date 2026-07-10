import { describe, expect, it } from 'vite-plus/test'
import {
  buildStepCanvasEdgeGeometryFromEdge,
  buildStepCanvasEdgeGeometryFromRenderProps,
} from '../step-canvas-edge-geometry'
import { CANVAS_HANDLE_POSITION } from '../../../types/canvas-domain-types'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'
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

    expect(geometry.hitPoints).toEqual([
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

    expect(geometry.hitPoints).toEqual([
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

    expect(geometry.hitPoints).toEqual([
      { x: 100, y: 150 },
      { x: 100, y: 198 },
      { x: 100, y: 200 },
      { x: 300, y: 200 },
      { x: 300, y: 202 },
      { x: 300, y: 250 },
    ])
  })

  it('routes mixed horizontal and vertical handles through the endpoint stubs', () => {
    const geometry = buildStepCanvasEdgeGeometryFromRenderProps({
      sourceX: 100,
      sourceY: 50,
      targetX: 210,
      targetY: 160,
      sourcePosition: CANVAS_HANDLE_POSITION.Right,
      targetPosition: CANVAS_HANDLE_POSITION.Top,
    })

    expect(geometry.hitPoints).toEqual([
      { x: 100, y: 50 },
      { x: 148, y: 50 },
      { x: 148, y: 112 },
      { x: 210, y: 112 },
      { x: 210, y: 160 },
    ])
  })

  it('routes facing horizontal handles through a vertical middle run', () => {
    const geometry = buildStepCanvasEdgeGeometryFromRenderProps({
      sourceX: 100,
      sourceY: 50,
      targetX: 220,
      targetY: 130,
      sourcePosition: CANVAS_HANDLE_POSITION.Right,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })

    expect(geometry.hitPoints).toEqual([
      { x: 100, y: 50 },
      { x: 148, y: 50 },
      { x: 160, y: 50 },
      { x: 160, y: 130 },
      { x: 172, y: 130 },
      { x: 220, y: 130 },
    ])
  })

  it('routes same-side horizontal handles through a horizontal middle run', () => {
    const geometry = buildStepCanvasEdgeGeometryFromRenderProps({
      sourceX: 100,
      sourceY: 50,
      targetX: 220,
      targetY: 130,
      sourcePosition: CANVAS_HANDLE_POSITION.Left,
      targetPosition: CANVAS_HANDLE_POSITION.Left,
    })

    expect(geometry.hitPoints).toEqual([
      { x: 100, y: 50 },
      { x: 52, y: 50 },
      { x: 52, y: 90 },
      { x: 172, y: 90 },
      { x: 172, y: 130 },
      { x: 220, y: 130 },
    ])
  })

  it('routes left-to-top mixed handles through both endpoint stubs', () => {
    const geometry = buildStepCanvasEdgeGeometryFromRenderProps({
      sourceX: 100,
      sourceY: 50,
      targetX: 210,
      targetY: 160,
      sourcePosition: CANVAS_HANDLE_POSITION.Left,
      targetPosition: CANVAS_HANDLE_POSITION.Top,
    })

    expect(geometry.hitPoints).toEqual([
      { x: 100, y: 50 },
      { x: 52, y: 50 },
      { x: 52, y: 112 },
      { x: 210, y: 112 },
      { x: 210, y: 160 },
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
    expect(geometry!.hitPoints).toEqual([
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
    expect(geometry!.hitPoints).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 50 },
      { x: 230, y: 50 },
      { x: 230, y: 0 },
    ])
  })

  it('keeps the minimum stubs when the split column lands exactly on a node edge', () => {
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
      position: { x: 200, y: 0 },
      width: 100,
      height: 100,
      data: {},
    }
    const edge: Edge = {
      id: 'edge-3',
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
    expect(geometry!.hitPoints).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 148 },
      { x: 200, y: 148 },
      { x: 200, y: -48 },
      { x: 250, y: -48 },
      { x: 250, y: 0 },
    ])
  })

  it('resolves mixed horizontal and vertical handles from edge endpoints', () => {
    const sourceNode: Node = {
      id: 'source',
      type: 'text',
      position: { x: 0, y: 0 },
      width: 100,
      height: 100,
      data: {},
    }
    const targetNode: Node = {
      id: 'target',
      type: 'text',
      position: { x: 160, y: 160 },
      width: 100,
      height: 100,
      data: {},
    }
    const edge: Edge = {
      id: 'edge-4',
      type: 'step',
      source: 'source',
      target: 'target',
      sourceHandle: 'right',
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
    expect(geometry!.hitPoints).toEqual([
      { x: 100, y: 50 },
      { x: 148, y: 50 },
      { x: 148, y: 112 },
      { x: 210, y: 112 },
      { x: 210, y: 160 },
    ])
  })
})
