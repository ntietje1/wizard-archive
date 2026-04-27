import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CanvasConnectionLayer } from '../canvas-connection-layer'
import { buildConnectionDraftGeometry } from '../canvas-connection-layer-geometry'
import type { CanvasConnectionDraft } from '../canvas-connection-layer-geometry'
import {
  buildBezierCanvasEdgeGeometryFromEdge,
  buildBezierCanvasEdgeGeometryFromRenderProps,
} from '../../edges/bezier/bezier-canvas-edge-geometry'
import type { CanvasEdgeType } from '../../edges/canvas-edge-types'
import { buildStepCanvasEdgeGeometryFromEdge } from '../../edges/step/step-canvas-edge-geometry'
import { buildStraightCanvasEdgeGeometryFromEdge } from '../../edges/straight/straight-canvas-edge-geometry'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import { createCanvasEngine } from '../../system/canvas-engine'
import { Position } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'

const sourceNode: Node = {
  id: 'source',
  type: 'text',
  position: { x: 0, y: 0 },
  width: 100,
  height: 50,
  data: {},
}
const targetNode: Node = {
  id: 'target',
  type: 'text',
  position: { x: 200, y: 0 },
  width: 100,
  height: 50,
  data: {},
}

const nodesById = new Map([
  [sourceNode.id, sourceNode],
  [targetNode.id, targetNode],
])

function createSnappedDraft(): CanvasConnectionDraft {
  return {
    source: {
      nodeId: 'source',
      handleId: 'right',
      position: Position.Right,
      point: { x: 100, y: 25 },
    },
    current: { x: 200, y: 25 },
    snapTarget: {
      nodeId: 'target',
      handleId: 'left',
      position: Position.Left,
      point: { x: 200, y: 25 },
    },
  }
}

function buildExpectedEdge(type: CanvasEdgeType): Edge {
  return {
    id: 'edge-1',
    source: 'source',
    target: 'target',
    sourceHandle: 'right',
    targetHandle: 'left',
    type,
  }
}

function buildExpectedPath(type: CanvasEdgeType) {
  const edge = buildExpectedEdge(type)

  switch (type) {
    case 'bezier':
      return buildBezierCanvasEdgeGeometryFromEdge(edge, nodesById)?.path
    case 'straight':
      return buildStraightCanvasEdgeGeometryFromEdge(edge, nodesById)?.path
    case 'step':
      return buildStepCanvasEdgeGeometryFromEdge(edge, nodesById)?.path
  }
}

function parseCubicPath(path: string) {
  const match = path.match(/^M ([^,]+),([^ ]+) C ([^,]+),([^ ]+) ([^,]+),([^ ]+) ([^,]+),([^ ]+)$/)
  if (!match) return null

  return match.slice(1).map(Number)
}

describe('CanvasConnectionLayer', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
  })

  it.each<CanvasEdgeType>(['bezier', 'straight', 'step'])(
    'uses committed %s edge geometry when snapped to a target handle',
    (type) => {
      const geometry = buildConnectionDraftGeometry(type, createSnappedDraft(), nodesById)

      expect(geometry?.path).toBe(buildExpectedPath(type))
    },
  )

  it('uses a cubic drag-vector preview for unsnapped bezier drags', () => {
    const draft: CanvasConnectionDraft = {
      source: {
        nodeId: 'source',
        handleId: 'right',
        position: Position.Right,
        point: { x: 100, y: 25 },
      },
      current: { x: 220, y: 85 },
      snapTarget: null,
    }
    const geometry = buildConnectionDraftGeometry('bezier', draft, nodesById)
    const connectedStyleGeometry = buildBezierCanvasEdgeGeometryFromRenderProps({
      sourceX: draft.source.point.x,
      sourceY: draft.source.point.y,
      targetX: draft.current.x,
      targetY: draft.current.y,
      sourcePosition: draft.source.position,
      targetPosition: Position.Left,
    })

    expect(geometry?.path).toContain(' C ')
    expect(geometry?.path).not.toBe(connectedStyleGeometry?.path)

    const values = parseCubicPath(geometry?.path ?? '')
    expect(values).not.toBeNull()
    expect(values?.[2]).toBeGreaterThan(draft.source.point.x)
    expect(values?.[4]).toBeLessThan(draft.current.x)
    expect(values?.[5]).toBeLessThan(draft.current.y)
    expect(values?.[6]).toBe(draft.current.x)
    expect(values?.[7]).toBe(draft.current.y)
  })

  it('renders the active edge type with the current edge tool style', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({ nodes: [sourceNode] })
    useCanvasToolStore.getState().setEdgeType('straight')
    useCanvasToolStore.getState().setStrokeColor('var(--t-red)')
    useCanvasToolStore.getState().setStrokeSize(8)
    useCanvasToolStore.getState().setStrokeOpacity(42)

    render(
      <CanvasEngineProvider engine={engine}>
        <svg>
          <CanvasConnectionLayer
            draft={{
              source: {
                nodeId: 'source',
                handleId: 'right',
                position: Position.Right,
                point: { x: 100, y: 25 },
              },
              current: { x: 150, y: 40 },
              snapTarget: null,
            }}
          />
        </svg>
      </CanvasEngineProvider>,
    )

    const preview = screen.getByTestId('canvas-connection-preview')
    expect(preview).toHaveAttribute('data-edge-type', 'straight')
    expect(preview).toHaveAttribute('data-snap-target', 'false')
    expect(preview).toHaveStyle({
      opacity: '0.42',
      stroke: 'var(--t-red)',
      strokeWidth: '8',
    })

    engine.destroy()
  })
})
