import { describe, expect, it } from 'vitest'
import {
  areCanvasPreviewEdgeRendersEqual,
  areCanvasPreviewNodeShellsEqual,
  selectCanvasPreviewEdgeRender,
  selectCanvasPreviewNodeShell,
} from '../canvas-read-only-preview-model'
import type { CanvasEngineSnapshot, CanvasInternalNode } from '../../system/canvas-engine-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import type {
  CanvasPreviewEdgeRender,
  CanvasPreviewEdgeType,
  CanvasPreviewNodeShellSnapshot,
} from '../canvas-read-only-preview-model'

describe('canvas read-only preview model', () => {
  it('returns null when selecting a missing node shell', () => {
    expect(selectCanvasPreviewNodeShell(undefined)).toBeNull()
  })

  it('uses measured dimensions when the document node has no explicit size', () => {
    const node = createNode({ id: 'node-1', width: undefined, height: undefined })
    const edge = createEdge({ id: 'edge-1', source: node.id, target: node.id, type: 'straight' })
    const snapshot = createSnapshot({
      edge,
      nodes: [node],
      measured: new Map([[node.id, { width: 320, height: 180 }]]),
    })
    const shell = selectCanvasPreviewNodeShell(snapshot.nodeLookup.get(node.id))

    expect(shell).toEqual({
      id: 'node-1',
      type: 'text',
      className: undefined,
      position: { x: 10, y: 20 },
      width: 320,
      height: 180,
      zIndex: 0,
    })
  })

  it('compares node shell snapshots by rendered fields', () => {
    const shell: CanvasPreviewNodeShellSnapshot = {
      id: 'node-1',
      type: 'text',
      className: undefined,
      position: { x: 10, y: 20 },
      width: 100,
      height: 80,
      zIndex: 1,
    }

    expect(areCanvasPreviewNodeShellsEqual(shell, { ...shell })).toBe(true)
    expect(
      areCanvasPreviewNodeShellsEqual(shell, {
        ...shell,
        position: { x: 10, y: 21 },
      }),
    ).toBe(false)
  })

  it('selects edge render geometry from endpoint nodes', () => {
    const source = createNode({ id: 'source', position: { x: 0, y: 0 } })
    const target = createNode({ id: 'target', position: { x: 200, y: 0 } })
    const edge = createEdge({ id: 'edge-1', source: source.id, target: target.id, type: 'bad' })
    const render = selectCanvasPreviewEdgeRender(
      createSnapshot({ nodes: [source, target], edge }),
      edge.id,
    )

    expect(render).toEqual(
      expect.objectContaining({
        edge,
        type: 'bezier',
      }),
    )
    expect(render?.geometry.path).toContain('C')
  })

  it('returns null when edge endpoint nodes are missing', () => {
    const edge = createEdge({ id: 'edge-1', source: 'source', target: 'target', type: 'straight' })

    expect(selectCanvasPreviewEdgeRender(createSnapshot({ nodes: [], edge }), edge.id)).toBeNull()
  })

  it('compares edge renders by edge identity, type, and path', () => {
    const edge = createEdge({ id: 'edge-1', source: 'source', target: 'target', type: 'straight' })
    const edgeType: CanvasPreviewEdgeType = 'straight'
    const render: CanvasPreviewEdgeRender = {
      edge,
      type: edgeType,
      geometry: {
        path: 'M 0,0 L 1,1',
        labelX: 0,
        labelY: 0,
        hitPoints: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    }

    expect(areCanvasPreviewEdgeRendersEqual(render, { ...render })).toBe(true)
    expect(
      areCanvasPreviewEdgeRendersEqual(render, {
        ...render,
        geometry: { ...render.geometry, path: 'M 0,0 L 2,2' },
      }),
    ).toBe(false)
  })
})

function createNode(options: {
  id: string
  height?: number
  position?: { x: number; y: number }
  width?: number
}): CanvasDocumentNode {
  const position = options.position ?? { x: 10, y: 20 }
  return {
    id: options.id,
    type: 'text',
    position,
    // Distinguish omitted properties from explicit undefined so tests can exercise measured fallback.
    width: 'width' in options ? options.width : 100,
    height: 'height' in options ? options.height : 80,
    data: {},
  } as CanvasDocumentNode
}

function createEdge({
  id,
  source,
  target,
  type,
}: {
  id: string
  source: string
  target: string
  type: string
}): CanvasDocumentEdge {
  return {
    id,
    source,
    target,
    sourceHandle: null,
    targetHandle: null,
    style: {},
    type,
  } as CanvasDocumentEdge
}

function createSnapshot({
  edge,
  measured,
  nodes,
}: {
  edge: CanvasDocumentEdge
  measured?: ReadonlyMap<string, CanvasInternalNode['measured']>
  nodes: ReadonlyArray<CanvasDocumentNode>
}): Pick<CanvasEngineSnapshot, 'edgeLookup' | 'nodeLookup'> {
  return {
    edgeLookup: new Map([
      [edge.id, { id: edge.id, edge, selected: false, zIndex: 0, visible: true }],
    ]),
    nodeLookup: new Map(
      nodes.map((node): [string, CanvasInternalNode] => [
        node.id,
        {
          id: node.id,
          node,
          positionAbsolute: node.position,
          measured: measured?.get(node.id) ?? {},
          selected: false,
          dragging: false,
          resizing: false,
          zIndex: 0,
          visible: true,
        },
      ]),
    ),
  }
}
