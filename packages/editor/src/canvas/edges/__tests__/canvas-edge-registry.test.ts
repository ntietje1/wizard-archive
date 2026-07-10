import { describe, expect, it, vi } from 'vite-plus/test'
import {
  buildCanvasEdgeGeometry,
  getCanvasEdgeInspectableProperties,
  getCanvasEdgesMatchingLasso,
  getCanvasEdgesMatchingRectangle,
  normalizeCanvasEdge,
} from '../canvas-edge-registry'
import { clampCanvasEdgeStrokeWidth } from '../shared/canvas-edge-style'
import type { CanvasStrokeSizePropertyBinding } from '../../properties/canvas-property-types'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../document-contract'

function createNode(id: string, x: number, y: number): Node {
  return {
    id,
    type: 'text',
    position: { x, y },
    width: 40,
    height: 40,
    data: {},
  }
}

function createBezierEdge(overrides?: Partial<Edge>): Edge {
  return {
    id: 'edge-1',
    source: 'source',
    target: 'target',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'bezier',
    ...overrides,
  }
}

function createStraightEdge(overrides?: Partial<Edge>): Edge {
  return {
    id: 'straight-edge',
    source: 'source',
    target: 'target',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'straight',
    ...overrides,
  }
}

function createStepEdge(overrides?: Partial<Edge>): Edge {
  return {
    id: 'step-edge',
    source: 'source',
    target: 'target',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'step',
    ...overrides,
  }
}

describe('canvas edge specs', () => {
  const nodes = [createNode('source', 0, 0), createNode('target', 160, 0)]

  it('selects bezier edges through rectangle hit testing', () => {
    const edges = [
      createBezierEdge(),
      createBezierEdge({
        id: 'edge-2',
        source: 'target',
        target: 'source',
        sourceHandle: undefined,
        targetHandle: undefined,
      }),
    ]

    expect(
      getCanvasEdgesMatchingRectangle(
        nodes,
        edges,
        { x: 80, y: 10, width: 40, height: 20 },
        { zoom: 1 },
      ),
    ).toEqual(new Set(['edge-1', 'edge-2']))

    expect(
      getCanvasEdgesMatchingRectangle(
        nodes,
        [createBezierEdge()],
        { x: 80, y: 60, width: 40, height: 20 },
        { zoom: 1 },
      ),
    ).toEqual(new Set())
  })

  it('selects only intersecting edges through lasso hit testing', () => {
    const crossingEdge = createBezierEdge({
      id: 'crossing-edge',
      source: 'source',
      target: 'target',
    })
    const outsideEdge = createBezierEdge({
      id: 'outside-edge',
      source: 'target',
      target: 'target-2',
    })
    const lassoNodes = [...nodes, createNode('target-2', 160, 120)]

    expect(
      getCanvasEdgesMatchingLasso(
        lassoNodes,
        [crossingEdge, outsideEdge],
        [
          { x: 60, y: 0 },
          { x: 120, y: 0 },
          { x: 120, y: 40 },
          { x: 60, y: 40 },
        ],
        { zoom: 1 },
      ),
    ).toEqual(new Set(['crossing-edge']))
  })

  it('matches straight edges through rectangle and lasso hit testing', () => {
    const edge = createStraightEdge()

    expect(
      getCanvasEdgesMatchingRectangle(
        nodes,
        [edge],
        { x: 80, y: 10, width: 40, height: 20 },
        { zoom: 1 },
      ),
    ).toEqual(new Set(['straight-edge']))
    expect(
      getCanvasEdgesMatchingLasso(
        nodes,
        [edge],
        [
          { x: 80, y: 5 },
          { x: 120, y: 5 },
          { x: 120, y: 35 },
          { x: 80, y: 35 },
        ],
        { zoom: 1 },
      ),
    ).toEqual(new Set(['straight-edge']))
  })

  it('matches step edges through rectangle and lasso hit testing', () => {
    const stepNodes = [createNode('source', 0, 0), createNode('target', 80, 120)]
    const edge = createStepEdge({ target: 'target' })

    expect(
      getCanvasEdgesMatchingRectangle(
        stepNodes,
        [edge],
        { x: 10, y: 60, width: 20, height: 40 },
        { zoom: 1 },
      ),
    ).toEqual(new Set(['step-edge']))
    expect(
      getCanvasEdgesMatchingLasso(
        stepNodes,
        [edge],
        [
          { x: 10, y: 55 },
          { x: 30, y: 55 },
          { x: 30, y: 105 },
          { x: 10, y: 105 },
        ],
        { zoom: 1 },
      ),
    ).toEqual(new Set(['step-edge']))
  })

  it('rejects unsupported edge types', () => {
    const unsupportedEdge = {
      ...createBezierEdge({ id: 'edge-fallback' }),
      type: 'curved',
    } as unknown as Edge

    expect(normalizeCanvasEdge(unsupportedEdge)).toBeNull()
  })

  it('builds registered edge geometry directly for valid edges', () => {
    const nodesById = new Map(nodes.map((node) => [node.id, node] as const))

    expect(buildCanvasEdgeGeometry(createBezierEdge(), nodesById)).toMatchObject({
      path: expect.stringContaining(' C '),
    })
    expect(
      buildCanvasEdgeGeometry(
        {
          ...createBezierEdge(),
          type: 'curved',
        } as unknown as Edge,
        nodesById,
      ),
    ).toBeNull()
  })

  it('normalizes zero-width edge styles to the minimum visible stroke width', () => {
    expect(normalizeCanvasEdge(createBezierEdge({ style: { strokeWidth: 0 } }))).toMatchObject({
      style: {
        strokeWidth: 1,
      },
    })
  })

  it('defaults non-finite edge stroke width inputs', () => {
    expect(clampCanvasEdgeStrokeWidth(Number.NaN)).toBe(1.5)
  })

  it('renders whitespace edge strokes with the default visible stroke', () => {
    expect(normalizeCanvasEdge(createBezierEdge({ style: { stroke: '   ' } }))).toMatchObject({
      style: {
        stroke: 'var(--foreground)',
      },
    })
  })

  it('normalizes edge opacity into the renderable opacity range', () => {
    expect(normalizeCanvasEdge(createBezierEdge({ style: { opacity: 2 } }))).toMatchObject({
      style: {
        opacity: 1,
      },
    })
    expect(normalizeCanvasEdge(createBezierEdge({ style: { opacity: -0.5 } }))).toMatchObject({
      style: {
        opacity: 0,
      },
    })
  })

  it('returns empty inspectable properties for invalid edges and typed properties for valid edges', () => {
    const patchEdge = () => undefined

    expect(
      getCanvasEdgeInspectableProperties(
        normalizeCanvasEdge({
          ...createBezierEdge({
            id: 'edge-invalid-properties',
          }),
          source: null,
        } as unknown as Edge),
        patchEdge,
      ).bindings,
    ).toEqual([])

    // Expect 2 bindings: stroke paint and stroke width.
    expect(
      getCanvasEdgeInspectableProperties(normalizeCanvasEdge(createStraightEdge()), patchEdge)
        .bindings,
    ).toHaveLength(2)
  })

  it('clamps selected edge stroke width edits to the property range', () => {
    const patchEdge = vi.fn()
    const properties = getCanvasEdgeInspectableProperties(
      normalizeCanvasEdge(createStraightEdge()),
      patchEdge,
    )
    const strokeSizeBinding = properties.bindings.find(
      (binding): binding is CanvasStrokeSizePropertyBinding =>
        binding.definition.kind === 'strokeSize',
    )

    expect(strokeSizeBinding).toBeDefined()
    if (!strokeSizeBinding) {
      throw new Error('Expected edge stroke-size binding')
    }

    strokeSizeBinding.setValue(120)

    expect(patchEdge).toHaveBeenCalledWith('straight-edge', {
      style: {
        strokeWidth: 99,
      },
    })
  })
})
