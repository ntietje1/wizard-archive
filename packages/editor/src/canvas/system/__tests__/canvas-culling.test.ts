import { describe, expect, it } from 'vite-plus/test'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import { createInitialCanvasSelectionState } from '../canvas-selection'
import {
  EMPTY_EDGE_IDS_BY_NODE_ID,
  EMPTY_EDGE_LOOKUP,
  EMPTY_EDGES,
  EMPTY_IDS,
  EMPTY_NODE_LOOKUP,
  EMPTY_NODES,
  EMPTY_SET,
  projectCanvasDocumentSnapshot,
} from '../canvas-document-projector'
import {
  computeCanvasCullingSnapshot,
  getCanvasCullingDiff,
  isCanvasCullingDiffEmpty,
} from '../canvas-culling'
import { createCanvasCullingManager } from '../canvas-culling-manager'
import { createCanvasGeometryIndex } from '../canvas-geometry-index'
import { DEFAULT_CANVAS_VIEWPORT } from '../canvas-viewport-manager'
import type { CanvasSelectionState } from '../canvas-selection'
import type { CanvasEngineSnapshot } from '../canvas-engine-types'
import type { CanvasDocumentNode } from '../../document-contract'
import { createEdge, createNode } from './canvas-test-fixtures'

describe('canvas culling', () => {
  it('returns empty snapshots for missing or invalid surface bounds', () => {
    const snapshot = createProjectedSnapshot([
      {
        ...createNode('far', 0),
        position: { x: 2000, y: 0 },
        width: 20,
        height: 20,
      },
    ])

    expect(cull(snapshot, null).culledNodeIds).toEqual(new Set())
    expect(cull(snapshot, { width: 0, height: 100 }).culledNodeIds).toEqual(new Set())
    expect(cull(snapshot, { width: 100, height: -1 }).culledNodeIds).toEqual(new Set())
  })

  it('keeps selected, previewed, and dragged nodes visible while culling ordinary offscreen nodes', () => {
    const snapshot = {
      ...createProjectedSnapshot([
        {
          ...createNode('selected', 0),
          position: { x: 2000, y: 0 },
          width: 20,
          height: 20,
        },
        {
          ...createNode('previewed', 1),
          position: { x: 2100, y: 0 },
          width: 20,
          height: 20,
        },
        {
          ...createNode('dragged', 2),
          position: { x: 2200, y: 0 },
          width: 20,
          height: 20,
        },
        {
          ...createNode('ordinary', 3),
          position: { x: 2300, y: 0 },
          width: 20,
          height: 20,
        },
      ]),
      selection: createSelection({
        nodeIds: new Set([testCanvasNodeId('selected')]),
        pendingPreviewNodeIds: new Set([testCanvasNodeId('previewed')]),
      }),
    }

    const result = cull(snapshot, undefined, new Set([testCanvasNodeId('dragged')]))

    expect(result.culledNodeIds).toEqual(new Set([testCanvasNodeId('ordinary')]))
  })

  it('keeps selected edges and edges connected to always-visible nodes visible', () => {
    const snapshot = {
      ...createProjectedSnapshot(
        [
          {
            ...createNode('selected-node', 0),
            position: { x: 2000, y: 0 },
            width: 20,
            height: 20,
          },
          {
            ...createNode('other-a', 1),
            position: { x: 2100, y: 0 },
            width: 20,
            height: 20,
          },
          {
            ...createNode('other-b', 2),
            position: { x: 2200, y: 0 },
            width: 20,
            height: 20,
          },
          {
            ...createNode('other-c', 3),
            position: { x: 2300, y: 0 },
            width: 20,
            height: 20,
          },
        ],
        [
          createEdge(
            'connected-edge',
            testCanvasNodeId('selected-node'),
            testCanvasNodeId('other-a'),
          ),
          createEdge('selected-edge', 'other-a', 'other-b'),
          createEdge('ordinary-edge', 'other-b', 'other-c'),
        ],
      ),
      selection: createSelection({
        nodeIds: new Set([testCanvasNodeId('selected-node')]),
        edgeIds: new Set(['selected-edge']),
      }),
    }

    const result = cull(snapshot)

    expect(result.culledEdgeIds).toEqual(new Set(['ordinary-edge']))
  })

  it('diffs culled ids in both directions and reports empty diffs', () => {
    const previous = {
      culledNodeIds: new Set([testCanvasNodeId('a')]),
      culledEdgeIds: new Set(['edge-a']),
    }
    const next = {
      culledNodeIds: new Set([testCanvasNodeId('b')]),
      culledEdgeIds: new Set(['edge-a']),
    }

    const diff = getCanvasCullingDiff(previous, next)

    expect(diff.nodeIds).toEqual(
      new Map([
        [testCanvasNodeId('a'), false],
        [testCanvasNodeId('b'), true],
      ]),
    )
    expect(diff.edgeIds).toEqual(new Map())
    expect(isCanvasCullingDiffEmpty(diff)).toBe(false)
    expect(isCanvasCullingDiffEmpty(getCanvasCullingDiff(next, next))).toBe(true)
  })

  it('tracks culling manager diffs and resets to an empty baseline', () => {
    const manager = createCanvasCullingManager()
    const snapshot = createProjectedSnapshot([
      {
        ...createNode('far', 0),
        position: { x: 2000, y: 0 },
        width: 20,
        height: 20,
      },
    ])

    expect(
      manager.reconcile({
        snapshot,
        surfaceBounds: { width: 100, height: 100 },
        draggingNodeIds: EMPTY_SET,
      })?.nodeIds,
    ).toEqual(new Map([[testCanvasNodeId('far'), true]]))
    expect(
      manager.reconcile({
        snapshot,
        surfaceBounds: { width: 100, height: 100 },
        draggingNodeIds: EMPTY_SET,
      }),
    ).toBeNull()

    manager.reset()

    expect(
      manager.reconcile({
        snapshot,
        surfaceBounds: { width: 100, height: 100 },
        draggingNodeIds: EMPTY_SET,
      })?.nodeIds,
    ).toEqual(new Map([[testCanvasNodeId('far'), true]]))
  })

  it('uses measured and runtime geometry when deciding node visibility', () => {
    const geometryIndex = createCanvasGeometryIndex()
    const projected = createProjectedSnapshot([
      { ...createNode('measured', 0), position: { x: 800, y: 0 } },
      {
        ...createNode('dragged', 1),
        position: { x: 2000, y: 0 },
        width: 20,
        height: 20,
      },
      {
        ...createNode('resized', 2),
        position: { x: 800, y: 0 },
        width: 20,
        height: 20,
      },
    ])
    const measured = geometryIndex.measureNode(projected, testCanvasNodeId('measured'), {
      width: 20,
      height: 20,
    })?.snapshot as CanvasEngineSnapshot
    const dragged = geometryIndex.updateDraggedNodePositions(
      measured,
      new Map([[testCanvasNodeId('dragged'), { x: 0, y: 0 }]]),
    )?.snapshot as CanvasEngineSnapshot
    const resized = geometryIndex.updateResizedNodeBounds(
      dragged,
      new Map([[testCanvasNodeId('resized'), { position: { x: 0, y: 0 }, width: 20, height: 20 }]]),
    )?.snapshot as CanvasEngineSnapshot

    const result = cull(resized)

    expect(result.culledNodeIds).toEqual(new Set([testCanvasNodeId('measured')]))
  })

  it('uses stroke padding and edge interaction padding when intersecting the viewport', () => {
    const ordinary = {
      ...createNode('ordinary', 0),
      position: { x: 613, y: 0 },
      width: 1,
      height: 1,
    }
    const stroke = {
      ...createNode('stroke', 1),
      type: 'stroke',
      position: { x: 613, y: 20 },
      width: 1,
      height: 1,
      data: {
        points: [
          [0, 0, 0.5],
          [1, 0, 0.5],
        ],
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        color: '#111827',
        size: 2,
      },
    } satisfies CanvasDocumentNode
    const edge = {
      ...createEdge('edge-1', 'edge-source', 'edge-target'),
      style: { strokeWidth: 4 },
    }
    const snapshot = createProjectedSnapshot(
      [
        ordinary,
        stroke,
        {
          ...createNode('edge-source', 2),
          position: { x: 613, y: 40 },
          width: 1,
          height: 1,
        },
        {
          ...createNode('edge-target', 3),
          position: { x: 650, y: 40 },
          width: 1,
          height: 1,
        },
      ],
      [edge],
    )

    const result = cull(snapshot)

    expect(result.culledNodeIds).toEqual(
      new Set([
        testCanvasNodeId('ordinary'),
        testCanvasNodeId('edge-source'),
        testCanvasNodeId('edge-target'),
      ]),
    )
    expect(result.culledEdgeIds).toEqual(new Set())
  })
})

function cull(
  snapshot: CanvasEngineSnapshot,
  surfaceBounds: Pick<DOMRect, 'width' | 'height'> | null = { width: 100, height: 100 },
  draggingNodeIds: ReadonlySet<string> = EMPTY_SET,
) {
  return computeCanvasCullingSnapshot({
    viewport: snapshot.viewport,
    surfaceBounds,
    nodeLookup: snapshot.nodeLookup,
    edges: snapshot.edges,
    selection: snapshot.selection,
    draggingNodeIds,
  })
}

function createProjectedSnapshot(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  edges = EMPTY_EDGES,
): CanvasEngineSnapshot {
  return projectCanvasDocumentSnapshot({
    snapshot: createSnapshot(),
    nodes,
    edges,
    draggingNodeIds: EMPTY_SET,
  }) as CanvasEngineSnapshot
}

function createSnapshot(): CanvasEngineSnapshot {
  return {
    nodes: EMPTY_NODES,
    edges: EMPTY_EDGES,
    nodeIds: EMPTY_IDS,
    edgeIds: EMPTY_IDS,
    nodeLookup: EMPTY_NODE_LOOKUP,
    edgeLookup: EMPTY_EDGE_LOOKUP,
    edgeIdsByNodeId: EMPTY_EDGE_IDS_BY_NODE_ID,
    selection: createInitialCanvasSelectionState(),
    selectedNodeIds: EMPTY_SET,
    selectedEdgeIds: EMPTY_SET,
    dirtyNodeIds: EMPTY_SET,
    dirtyEdgeIds: EMPTY_SET,
    viewport: DEFAULT_CANVAS_VIEWPORT,
    cameraState: 'idle',
    debouncedZoomLevel: DEFAULT_CANVAS_VIEWPORT.zoom,
    version: 0,
  }
}

function createSelection({
  nodeIds = EMPTY_SET,
  edgeIds = EMPTY_SET,
  pendingPreviewNodeIds,
}: {
  nodeIds?: ReadonlySet<string>
  edgeIds?: ReadonlySet<string>
  pendingPreviewNodeIds?: ReadonlySet<string>
}): CanvasSelectionState {
  return {
    ...createInitialCanvasSelectionState(),
    nodeIds,
    edgeIds,
    pendingPreview: pendingPreviewNodeIds
      ? {
          kind: 'active',
          nodeIds: pendingPreviewNodeIds,
          edgeIds: EMPTY_SET,
        }
      : { kind: 'inactive' },
  }
}
