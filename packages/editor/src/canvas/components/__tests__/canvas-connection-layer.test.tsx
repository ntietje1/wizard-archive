import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { CanvasConnectionLayer } from '../canvas-connection-layer'
import { buildConnectionDraftGeometry } from '../canvas-connection-layer-geometry'
import type { CanvasConnectionDraft } from '../../runtime/interaction/canvas-connection-gesture-types'
import {
  buildBezierCanvasEdgeGeometryFromEdge,
  buildBezierCanvasEdgeGeometryFromRenderProps,
} from '../../edges/bezier/bezier-canvas-edge-geometry'
import { buildStepCanvasEdgeGeometryFromEdge } from '../../edges/step/step-canvas-edge-geometry'
import { buildStraightCanvasEdgeGeometryFromEdge } from '../../edges/straight/straight-canvas-edge-geometry'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasRuntime } from '../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime'
import { createCanvasToolStore } from '../../stores/canvas-tool-store'
import { createCanvasEngine } from '../../system/canvas-engine'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import { CANVAS_HANDLE_POSITION } from '../../types/canvas-domain-types'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
  CanvasEdgeType,
} from '../../document-contract'
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
const canvasToolStore = createCanvasToolStore()

function createSnappedDraft(): CanvasConnectionDraft {
  return {
    pointerId: 1,
    source: {
      nodeId: 'source',
      handleId: 'right',
      position: CANVAS_HANDLE_POSITION.Right,
      point: { x: 100, y: 25 },
    },
    current: { x: 200, y: 25 },
    snapTarget: {
      nodeId: 'target',
      handleId: 'left',
      position: CANVAS_HANDLE_POSITION.Left,
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
    default:
      throw new Error(`Unhandled canvas edge type in buildExpectedPath: ${String(type as unknown)}`)
  }
}

function parseCubicPath(path: string) {
  const match = path.match(/^M ([^,]+),([^ ]+) C ([^,]+),([^ ]+) ([^,]+),([^ ]+) ([^,]+),([^ ]+)$/)
  if (!match) return null

  return match.slice(1).map(Number)
}

function renderConnectionLayer(engine: CanvasEngine, draft: CanvasConnectionDraft) {
  return render(
    <CanvasEngineProvider engine={engine}>
      <CanvasRuntimeProvider {...createCanvasRuntime()} toolStore={canvasToolStore}>
        <svg>
          <CanvasConnectionLayer draft={draft} />
        </svg>
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>,
  )
}

describe('CanvasConnectionLayer', () => {
  let engine: CanvasEngine | null = null

  beforeEach(() => {
    canvasToolStore.getState().reset()
  })

  afterEach(() => {
    engine?.destroy()
    engine = null
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
      pointerId: 1,
      source: {
        nodeId: 'source',
        handleId: 'right',
        position: CANVAS_HANDLE_POSITION.Right,
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
      targetPosition: CANVAS_HANDLE_POSITION.Left,
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

  it('keeps a stationary bezier drag anchored at the source point', () => {
    const draft: CanvasConnectionDraft = {
      pointerId: 1,
      source: {
        nodeId: 'source',
        handleId: 'right',
        position: CANVAS_HANDLE_POSITION.Right,
        point: { x: 100, y: 25 },
      },
      current: { x: 100, y: 25 },
      snapTarget: null,
    }

    const geometry = buildConnectionDraftGeometry('bezier', draft, nodesById)
    const values = parseCubicPath(geometry?.path ?? '')

    expect(values).toEqual([100, 25, 100, 25, 100, 25, 100, 25])
  })

  it('caps the source control point at the pointer for short unsnapped bezier drags', () => {
    const draft: CanvasConnectionDraft = {
      pointerId: 1,
      source: {
        nodeId: 'source',
        handleId: 'right',
        position: CANVAS_HANDLE_POSITION.Right,
        point: { x: 100, y: 25 },
      },
      current: { x: 110, y: 25 },
      snapTarget: null,
    }

    const geometry = buildConnectionDraftGeometry('bezier', draft, nodesById)
    const values = parseCubicPath(geometry?.path ?? '')

    expect(values).toEqual([100, 25, 110, 25, 106.5, 25, 110, 25])
  })

  it('uses the minimum source control distance for short unsnapped bezier drags', () => {
    const draft: CanvasConnectionDraft = {
      pointerId: 1,
      source: {
        nodeId: 'source',
        handleId: 'right',
        position: CANVAS_HANDLE_POSITION.Right,
        point: { x: 100, y: 25 },
      },
      current: { x: 140, y: 25 },
      snapTarget: null,
    }

    const geometry = buildConnectionDraftGeometry('bezier', draft, nodesById)
    const values = parseCubicPath(geometry?.path ?? '')

    expect(values).toEqual([100, 25, 124, 25, 126, 25, 140, 25])
  })

  it('uses the maximum source control distance for long unsnapped bezier drags', () => {
    const draft: CanvasConnectionDraft = {
      pointerId: 1,
      source: {
        nodeId: 'source',
        handleId: 'right',
        position: CANVAS_HANDLE_POSITION.Right,
        point: { x: 100, y: 25 },
      },
      current: { x: 600, y: 25 },
      snapTarget: null,
    }

    const geometry = buildConnectionDraftGeometry('bezier', draft, nodesById)
    const values = parseCubicPath(geometry?.path ?? '')

    expect(values).toEqual([100, 25, 280, 25, 425, 25, 600, 25])
  })

  it('renders the active edge type and authored stroke width', () => {
    engine = createCanvasEngine()
    engine.setDocumentSnapshot({ nodes: [sourceNode] })
    canvasToolStore.getState().setEdgeType('straight')
    canvasToolStore.getState().setStrokeColor('var(--t-red)')
    canvasToolStore.getState().setStrokeSize(8)
    canvasToolStore.getState().setStrokeOpacity(42)

    renderConnectionLayer(engine, {
      pointerId: 1,
      source: {
        nodeId: 'source',
        handleId: 'right',
        position: CANVAS_HANDLE_POSITION.Right,
        point: { x: 100, y: 25 },
      },
      current: { x: 150, y: 40 },
      snapTarget: null,
    })

    const preview = screen.getByTestId('canvas-connection-preview')
    expect(preview).toHaveAttribute('data-edge-type', 'straight')
    expect(preview).toHaveAttribute('data-snap-target', 'false')
    expect(preview).toHaveAttribute('data-canvas-authored-stroke-width', '8')
    expect(preview).toHaveAttribute(
      'd',
      buildConnectionDraftGeometry(
        'straight',
        {
          pointerId: 1,
          source: {
            nodeId: 'source',
            handleId: 'right',
            position: CANVAS_HANDLE_POSITION.Right,
            point: { x: 100, y: 25 },
          },
          current: { x: 150, y: 40 },
          snapTarget: null,
        },
        new Map(),
      )?.path,
    )
  })

  it('renders snapped previews from the source and target endpoint nodes', () => {
    engine = createCanvasEngine()
    engine.setDocumentSnapshot({
      nodes: [
        sourceNode,
        targetNode,
        {
          id: 'unrelated-node',
          type: 'text',
          position: { x: 1000, y: 1000 },
          width: 100,
          height: 50,
          data: {},
        },
      ],
    })
    canvasToolStore.getState().setEdgeType('bezier')

    renderConnectionLayer(engine, createSnappedDraft())

    const preview = screen.getByTestId('canvas-connection-preview')
    expect(preview).toHaveAttribute('data-snap-target', 'true')
    expect(preview).toHaveAttribute('d', buildExpectedPath('bezier'))
  })

  it('clamps authored preview stroke width before rendering', () => {
    engine = createCanvasEngine()
    engine.setDocumentSnapshot({ nodes: [sourceNode] })
    canvasToolStore.getState().setStrokeSize(0)

    renderConnectionLayer(engine, {
      pointerId: 1,
      source: {
        nodeId: 'source',
        handleId: 'right',
        position: CANVAS_HANDLE_POSITION.Right,
        point: { x: 100, y: 25 },
      },
      current: { x: 150, y: 40 },
      snapTarget: null,
    })

    expect(screen.getByTestId('canvas-connection-preview')).toHaveAttribute(
      'data-canvas-authored-stroke-width',
      '1',
    )
  })
})
