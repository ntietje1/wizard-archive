import { afterEach, describe, expect, it } from 'vitest'
import { resolveCanvasContextMenuTarget } from '../canvas-context-menu-target'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'
import * as Y from 'yjs'

const openDocs: Array<Y.Doc> = []

function selectionSnapshot({
  nodeIds = new Set<string>(),
  edgeIds = new Set<string>(),
}: {
  nodeIds?: ReadonlySet<string>
  edgeIds?: ReadonlySet<string>
} = {}) {
  return { nodeIds, edgeIds }
}

function createContextMenuDoc() {
  const doc = new Y.Doc()
  openDocs.push(doc)
  return {
    doc,
    nodesMap: doc.getMap<Node>('nodes'),
    edgesMap: doc.getMap<Edge>('edges'),
  }
}

describe('resolveCanvasContextMenuTarget', () => {
  afterEach(() => {
    openDocs.splice(0).forEach((doc) => doc.destroy())
  })

  it('returns a pane target for an empty selection', () => {
    const { nodesMap, edgesMap } = createContextMenuDoc()

    expect(resolveCanvasContextMenuTarget(selectionSnapshot(), nodesMap, edgesMap)).toEqual({
      target: { kind: 'pane' },
      contributors: [],
    })
  })

  it('returns an embed-node target with contributors for a single valid embed selection', () => {
    const { nodesMap, edgesMap } = createContextMenuDoc()
    nodesMap.set('embed-1', {
      id: 'embed-1',
      type: 'embed',
      position: { x: 0, y: 0 },
      width: 200,
      height: 120,
      data: { sidebarItemId: 'note-1' },
    } as Node)

    const resolved = resolveCanvasContextMenuTarget(
      selectionSnapshot({ nodeIds: new Set(['embed-1']) }),
      nodesMap,
      edgesMap,
    )

    expect(resolved.target).toEqual({
      kind: 'embed-node',
      nodeId: 'embed-1',
      nodeType: 'embed',
      sidebarItemId: 'note-1',
    })
    expect(resolved.contributors).toHaveLength(1)
    expect(resolved.contributors[0]).toMatchObject({
      id: 'embed-node-open',
      surfaces: ['canvas'],
    })
  })

  it('keeps mixed selections on the mixed-selection target', () => {
    const { nodesMap, edgesMap } = createContextMenuDoc()
    nodesMap.set('node-1', {
      id: 'node-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node)
    edgesMap.set('edge-1', {
      id: 'edge-1',
      source: 'source-1',
      target: 'target-1',
      type: 'step',
    } as Edge)

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ nodeIds: new Set(['node-1']), edgeIds: new Set(['edge-1']) }),
        nodesMap,
        edgesMap,
      ),
    ).toEqual({
      target: { kind: 'mixed-selection', nodeIds: ['node-1'], edgeIds: ['edge-1'] },
      contributors: [],
    })
  })

  it('preserves a shared node type for valid multi-node selections', () => {
    const { nodesMap, edgesMap } = createContextMenuDoc()
    nodesMap.set('text-1', {
      id: 'text-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node)
    nodesMap.set('text-2', {
      id: 'text-2',
      type: 'text',
      position: { x: 20, y: 0 },
      data: {},
    } as Node)

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ nodeIds: new Set(['text-1', 'text-2']) }),
        nodesMap,
        edgesMap,
      ),
    ).toEqual({
      target: {
        kind: 'node-selection',
        nodeIds: ['text-1', 'text-2'],
        nodeType: 'text',
      },
      contributors: [],
    })
  })

  it('falls back to a mixed node type for valid multi-node selections with different types', () => {
    const { nodesMap, edgesMap } = createContextMenuDoc()
    nodesMap.set('text-1', {
      id: 'text-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node)
    nodesMap.set('embed-1', {
      id: 'embed-1',
      type: 'embed',
      position: { x: 20, y: 0 },
      width: 200,
      height: 120,
      data: { sidebarItemId: 'note-1' },
    } as Node)

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ nodeIds: new Set(['text-1', 'embed-1']) }),
        nodesMap,
        edgesMap,
      ),
    ).toEqual({
      target: {
        kind: 'node-selection',
        nodeIds: ['text-1', 'embed-1'],
        nodeType: null,
      },
      contributors: [],
    })
  })

  it('ignores malformed selected nodes and falls back to a generic node-selection target', () => {
    const { nodesMap, edgesMap } = createContextMenuDoc()
    nodesMap.set('bad-node', {
      id: 'bad-node',
      type: 'text',
      position: { x: 0, y: 0 },
      data: null,
    } as unknown as Node)

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ nodeIds: new Set(['bad-node']) }),
        nodesMap,
        edgesMap,
      ),
    ).toEqual({
      target: {
        kind: 'node-selection',
        nodeIds: [],
        nodeType: null,
      },
      contributors: [],
    })
  })

  it('drops missing node ids from the resolved node-selection target', () => {
    const { nodesMap, edgesMap } = createContextMenuDoc()
    nodesMap.set('text-1', {
      id: 'text-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node)

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ nodeIds: new Set(['missing-node', 'text-1']) }),
        nodesMap,
        edgesMap,
      ),
    ).toEqual({
      target: {
        kind: 'node-selection',
        nodeIds: ['text-1'],
        nodeType: 'text',
      },
      contributors: [],
    })
  })

  it('derives a shared edge type for valid edge-only selections', () => {
    const { nodesMap, edgesMap } = createContextMenuDoc()
    edgesMap.set('edge-1', {
      id: 'edge-1',
      source: 'source-1',
      target: 'target-1',
      type: 'step',
    } as Edge)
    edgesMap.set('edge-2', {
      id: 'edge-2',
      source: 'source-2',
      target: 'target-2',
      type: 'step',
    } as Edge)

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ edgeIds: new Set(['edge-1', 'edge-2']) }),
        nodesMap,
        edgesMap,
      ),
    ).toEqual({
      target: {
        kind: 'edge-selection',
        edgeIds: ['edge-1', 'edge-2'],
        edgeType: 'step',
      },
      contributors: [],
    })
  })

  it('falls back to a mixed edge type for edge-only selections with different edge types', () => {
    const { nodesMap, edgesMap } = createContextMenuDoc()
    edgesMap.set('edge-1', {
      id: 'edge-1',
      source: 'source-1',
      target: 'target-1',
      type: 'step',
    } as Edge)
    edgesMap.set('edge-2', {
      id: 'edge-2',
      source: 'source-2',
      target: 'target-2',
      type: 'straight',
    } as Edge)

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ edgeIds: new Set(['edge-1', 'edge-2']) }),
        nodesMap,
        edgesMap,
      ),
    ).toEqual({
      target: {
        kind: 'edge-selection',
        edgeIds: ['edge-1', 'edge-2'],
        edgeType: null,
      },
      contributors: [],
    })
  })

  it('drops missing edge ids from the resolved edge-selection target', () => {
    const { nodesMap, edgesMap } = createContextMenuDoc()
    edgesMap.set('edge-1', {
      id: 'edge-1',
      source: 'source-1',
      target: 'target-1',
      type: 'straight',
    } as Edge)

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ edgeIds: new Set(['missing-edge', 'edge-1']) }),
        nodesMap,
        edgesMap,
      ),
    ).toEqual({
      target: {
        kind: 'edge-selection',
        edgeIds: ['edge-1'],
        edgeType: 'straight',
      },
      contributors: [],
    })
  })
})
