import { afterEach, describe, expect, it } from 'vitest'
import { resolveCanvasContextMenuTarget } from '../canvas-context-menu-target'
import { createCanvasEngine } from '../../../system/canvas-engine'
import type { CanvasEngine } from '../../../system/canvas-engine-types'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '~/features/canvas/domain/canvas-document'

const openEngines: Array<CanvasEngine> = []

function selectionSnapshot({
  nodeIds = new Set<string>(),
  edgeIds = new Set<string>(),
}: {
  nodeIds?: ReadonlySet<string>
  edgeIds?: ReadonlySet<string>
} = {}) {
  return { nodeIds, edgeIds }
}

function createContextMenuSnapshot({
  edges = [],
  nodes = [],
}: {
  edges?: ReadonlyArray<Edge>
  nodes?: ReadonlyArray<Node>
} = {}) {
  const engine = createCanvasEngine()
  openEngines.push(engine)
  engine.setDocumentSnapshot({ nodes, edges })
  return engine.getSnapshot()
}

describe('resolveCanvasContextMenuTarget', () => {
  afterEach(() => {
    openEngines.splice(0).forEach((engine) => engine.destroy())
  })

  it('returns a pane target for an empty selection', () => {
    expect(
      resolveCanvasContextMenuTarget(selectionSnapshot(), createContextMenuSnapshot()),
    ).toEqual({ kind: 'pane' })
  })

  it('returns an embed-node target for a single valid embed selection', () => {
    const snapshot = createContextMenuSnapshot({
      nodes: [
        {
          id: 'embed-1',
          type: 'embed',
          position: { x: 0, y: 0 },
          width: 200,
          height: 120,
          data: { sidebarItemId: 'note-1' },
        } as Node,
      ],
    })

    const resolved = resolveCanvasContextMenuTarget(
      selectionSnapshot({ nodeIds: new Set(['embed-1']) }),
      snapshot,
    )

    expect(resolved).toEqual({
      kind: 'embed-node',
      nodeId: 'embed-1',
      nodeType: 'embed',
      target: { kind: 'sidebarItem', sidebarItemId: 'note-1' },
    })
  })

  it('returns an embed-node target for a single external embed selection', () => {
    const snapshot = createContextMenuSnapshot({
      nodes: [
        {
          id: 'embed-1',
          type: 'embed',
          position: { x: 0, y: 0 },
          width: 200,
          height: 120,
          data: {
            target: {
              kind: 'externalUrl',
              url: 'https://example.com/file.pdf',
              name: 'file.pdf',
            },
          },
        } as Node,
      ],
    })

    const resolved = resolveCanvasContextMenuTarget(
      selectionSnapshot({ nodeIds: new Set(['embed-1']) }),
      snapshot,
    )

    expect(resolved).toEqual({
      kind: 'embed-node',
      nodeId: 'embed-1',
      nodeType: 'embed',
      target: {
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      },
    })
  })

  it('keeps an empty embed on the generic node-selection target', () => {
    const snapshot = createContextMenuSnapshot({
      nodes: [
        {
          id: 'embed-1',
          type: 'embed',
          position: { x: 0, y: 0 },
          width: 200,
          height: 120,
          data: { target: { kind: 'empty' } },
        } as Node,
      ],
    })

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ nodeIds: new Set(['embed-1']) }),
        snapshot,
      ),
    ).toEqual({
      kind: 'node-selection',
      nodeIds: ['embed-1'],
      nodeType: 'embed',
    })
  })

  it('keeps mixed selections on the mixed-selection target', () => {
    const snapshot = createContextMenuSnapshot({
      nodes: [
        {
          id: 'node-1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {},
        } as Node,
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'source-1',
          target: 'target-1',
          type: 'step',
        } as Edge,
      ],
    })

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ nodeIds: new Set(['node-1']), edgeIds: new Set(['edge-1']) }),
        snapshot,
      ),
    ).toEqual({ kind: 'mixed-selection', nodeIds: ['node-1'], edgeIds: ['edge-1'] })
  })

  it('preserves a shared node type for valid multi-node selections', () => {
    const snapshot = createContextMenuSnapshot({
      nodes: [
        {
          id: 'text-1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {},
        } as Node,
        {
          id: 'text-2',
          type: 'text',
          position: { x: 20, y: 0 },
          data: {},
        } as Node,
      ],
    })

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ nodeIds: new Set(['text-1', 'text-2']) }),
        snapshot,
      ),
    ).toEqual({
      kind: 'node-selection',
      nodeIds: ['text-1', 'text-2'],
      nodeType: 'text',
    })
  })

  it('falls back to a mixed node type for valid multi-node selections with different types', () => {
    const snapshot = createContextMenuSnapshot({
      nodes: [
        {
          id: 'text-1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {},
        } as Node,
        {
          id: 'embed-1',
          type: 'embed',
          position: { x: 20, y: 0 },
          width: 200,
          height: 120,
          data: { target: { kind: 'sidebarItem', sidebarItemId: 'note-1' } },
        } as Node,
      ],
    })

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ nodeIds: new Set(['text-1', 'embed-1']) }),
        snapshot,
      ),
    ).toEqual({
      kind: 'node-selection',
      nodeIds: ['text-1', 'embed-1'],
      nodeType: null,
    })
  })

  it('drops missing node ids from the resolved node-selection target', () => {
    const snapshot = createContextMenuSnapshot({
      nodes: [
        {
          id: 'text-1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {},
        } as Node,
      ],
    })

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ nodeIds: new Set(['missing-node', 'text-1']) }),
        snapshot,
      ),
    ).toEqual({
      kind: 'node-selection',
      nodeIds: ['text-1'],
      nodeType: 'text',
    })
  })

  it('derives a shared edge type for valid edge-only selections', () => {
    const snapshot = createContextMenuSnapshot({
      edges: [
        {
          id: 'edge-1',
          source: 'source-1',
          target: 'target-1',
          type: 'step',
        } as Edge,
        {
          id: 'edge-2',
          source: 'source-2',
          target: 'target-2',
          type: 'step',
        } as Edge,
      ],
    })

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ edgeIds: new Set(['edge-1', 'edge-2']) }),
        snapshot,
      ),
    ).toEqual({
      kind: 'edge-selection',
      edgeIds: ['edge-1', 'edge-2'],
      edgeType: 'step',
    })
  })

  it('falls back to a mixed edge type for edge-only selections with different edge types', () => {
    const snapshot = createContextMenuSnapshot({
      edges: [
        {
          id: 'edge-1',
          source: 'source-1',
          target: 'target-1',
          type: 'step',
        } as Edge,
        {
          id: 'edge-2',
          source: 'source-2',
          target: 'target-2',
          type: 'straight',
        } as Edge,
      ],
    })

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ edgeIds: new Set(['edge-1', 'edge-2']) }),
        snapshot,
      ),
    ).toEqual({
      kind: 'edge-selection',
      edgeIds: ['edge-1', 'edge-2'],
      edgeType: null,
    })
  })

  it('drops missing edge ids from the resolved edge-selection target', () => {
    const snapshot = createContextMenuSnapshot({
      edges: [
        {
          id: 'edge-1',
          source: 'source-1',
          target: 'target-1',
          type: 'straight',
        } as Edge,
      ],
    })

    expect(
      resolveCanvasContextMenuTarget(
        selectionSnapshot({ edgeIds: new Set(['missing-edge', 'edge-1']) }),
        snapshot,
      ),
    ).toEqual({
      kind: 'edge-selection',
      edgeIds: ['edge-1'],
      edgeType: 'straight',
    })
  })
})
