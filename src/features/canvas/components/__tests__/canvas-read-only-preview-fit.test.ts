import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CANVAS_READ_ONLY_PREVIEW_VIEWPORT,
  resolveCanvasReadOnlyPreviewViewport,
  selectCanvasReadOnlyPreviewFitNodes,
} from '../canvas-read-only-preview-fit'
import type { CanvasEngineSnapshot, CanvasInternalNode } from '../../system/canvas-engine'
import type { CanvasDocumentNode } from '../../types/canvas-domain-types'

describe('canvas read-only preview fit', () => {
  it('uses fallback nodes before the engine has projected node ids', () => {
    const fallback = [createNode({ id: 'fallback' })]

    expect(selectCanvasReadOnlyPreviewFitNodes(createSnapshot([]), fallback)).toBe(fallback)
  })

  it('selects projected nodes in engine order once available', () => {
    const first = createNode({ id: 'first' })
    const second = createNode({ id: 'second' })

    expect(selectCanvasReadOnlyPreviewFitNodes(createSnapshot([first, second]), [])).toEqual([
      first,
      second,
    ])
  })

  it('falls back to the default viewport for zero-sized surfaces', () => {
    expect(
      resolveCanvasReadOnlyPreviewViewport({
        fallbackNodes: [createNode({ id: 'node-1' })],
        fitPadding: 0,
        maxZoom: 4,
        minZoom: 0.01,
        size: { width: 0, height: 100 },
        snapshot: createSnapshot([]),
      }),
    ).toEqual(DEFAULT_CANVAS_READ_ONLY_PREVIEW_VIEWPORT)
  })

  it('falls back to the default viewport for zero-height surfaces', () => {
    expect(
      resolveCanvasReadOnlyPreviewViewport({
        fallbackNodes: [createNode({ id: 'node-1' })],
        fitPadding: 0,
        maxZoom: 4,
        minZoom: 0.01,
        size: { width: 100, height: 0 },
        snapshot: createSnapshot([]),
      }),
    ).toEqual(DEFAULT_CANVAS_READ_ONLY_PREVIEW_VIEWPORT)
  })

  it('resolves a fitted viewport from projected nodes', () => {
    expect(
      resolveCanvasReadOnlyPreviewViewport({
        fallbackNodes: [],
        fitPadding: 0,
        maxZoom: 4,
        minZoom: 0.01,
        size: { width: 400, height: 300 },
        snapshot: createSnapshot([createNode({ id: 'node-1', width: 100, height: 100 })]),
      }),
    ).toEqual({ x: 50, y: 0, zoom: 3 })
  })
})

function createNode({
  height = 100,
  id,
  width = 100,
}: {
  height?: number
  id: string
  width?: number
}): CanvasDocumentNode {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0 },
    width,
    height,
    data: {},
  } satisfies CanvasDocumentNode
}

function createSnapshot(
  nodes: ReadonlyArray<CanvasDocumentNode>,
): Pick<CanvasEngineSnapshot, 'nodeIds' | 'nodeLookup'> {
  return {
    nodeIds: nodes.map((node) => node.id),
    nodeLookup: new Map(
      nodes.map((node): [string, CanvasInternalNode] => [
        node.id,
        {
          id: node.id,
          node,
          positionAbsolute: node.position,
          measured: {},
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
