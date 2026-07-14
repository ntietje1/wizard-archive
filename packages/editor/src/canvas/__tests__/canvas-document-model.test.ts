import { describe, expect, it } from 'vite-plus/test'
import { parseCanvasAwarenessUser, parseCanvasDrawAwarenessState } from '../awareness'
import {
  normalizeCanvasDocumentEdge,
  normalizeCanvasDocumentNode,
  parseCanvasDocumentEdge,
  parseCanvasDocumentNode,
} from '../document-contract'
import { parseCanvasEdgeStyle, parseCanvasEdgeType } from '../edge'
import { parseCanvasEmbedNodeData } from '../embed-node-data'
import {
  parseCanvasBoundsDimensions,
  parseCanvasPoint2D,
  parseCanvasStrokeSelectionData,
} from '../geometry'
import { parseCanvasStrokeNodeData } from '../stroke-node-data'
import {
  parseCanvasNodeBorderWidth,
  parseCanvasNodeSurfaceColor,
  parseCanvasNodeSurfaceOpacity,
} from '../surface-style'
import { parseCanvasTextDocument } from '../text/model'

describe('canvas document model parsers', () => {
  it('parses geometry payloads into stable canvas values', () => {
    expect(parseCanvasPoint2D({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
    expect(parseCanvasBoundsDimensions({ width: 30, height: 40, x: 99 })).toEqual({
      width: 30,
      height: 40,
    })
    expect(
      parseCanvasStrokeSelectionData({
        points: [
          [0, 0, 0.5],
          [10, 10, 0.5],
        ],
        size: 4,
        bounds: { x: 0, y: 0, width: 10, height: 10 },
      }),
    ).toEqual({
      points: [
        [0, 0, 0.5],
        [10, 10, 0.5],
      ],
      size: 4,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
    })
  })

  it('keeps document node fields that belong in persisted canvas state', () => {
    expect(
      parseCanvasDocumentNode({
        id: 'node-1',
        type: 'text',
        position: { x: 10, y: 20 },
        data: { content: [{ type: 'paragraph' }] },
        width: 120,
        height: 36,
        zIndex: 7,
      }),
    ).toEqual({
      id: 'node-1',
      type: 'text',
      position: { x: 10, y: 20 },
      data: { content: [{ type: 'paragraph' }] },
      width: 120,
      height: 36,
      zIndex: 7,
    })
  })

  it('keeps renderer class names out of persisted canvas node state', () => {
    const nodeWithRendererClass = {
      id: 'node-1',
      type: 'text',
      position: { x: 10, y: 20 },
      data: { content: [{ type: 'paragraph' }] },
      className: 'rounded-lg bg-card',
    }

    expect(parseCanvasDocumentNode(nodeWithRendererClass)).toBeNull()
    expect(normalizeCanvasDocumentNode(nodeWithRendererClass)).toEqual({
      id: 'node-1',
      type: 'text',
      position: { x: 10, y: 20 },
      data: { content: [{ type: 'paragraph' }] },
    })
  })

  it('parses canvas surface styles and clamps bounded values', () => {
    expect(parseCanvasNodeSurfaceColor('var(--border)')).toBe('var(--border)')
    expect(parseCanvasNodeSurfaceOpacity(125)).toBe(100)
    expect(parseCanvasNodeBorderWidth(150)).toBe(99)
  })

  it('parses stroke, embed, and generic node data through the shared document model', () => {
    expect(
      parseCanvasStrokeNodeData({
        color: '#000',
        size: 4,
        opacity: 200,
        bounds: { x: 0, y: 0, width: 20, height: 10 },
        points: [[0, 0, 0.5]],
      }),
    ).toEqual({
      color: '#000',
      size: 4,
      opacity: 100,
      bounds: { x: 0, y: 0, width: 20, height: 10 },
      points: [[0, 0, 0.5]],
    })

    expect(
      parseCanvasEmbedNodeData({
        target: { kind: 'resource', resourceId: 'sidebar-1' },
        lockedAspectRatio: 1.25,
        backgroundOpacity: 120,
        textColor: 'var(--t-red)',
      }),
    ).toEqual({
      target: { kind: 'resource', resourceId: 'sidebar-1' },
      lockedAspectRatio: 1.25,
      backgroundOpacity: 100,
      textColor: 'var(--t-red)',
    })

    expect(
      parseCanvasDocumentNode({
        id: 'node-1',
        type: 'embed',
        position: { x: 0, y: 0 },
        data: { target: { kind: 'resource', resourceId: 'sidebar-1' } },
      })?.data,
    ).toEqual({ target: { kind: 'resource', resourceId: 'sidebar-1' } })
  })

  it('rejects legacy embed sidebarItemId at the document boundary', () => {
    const legacyNode = {
      id: 'node-1',
      type: 'embed',
      position: { x: 0, y: 0 },
      data: { sidebarItemId: 'sidebar-1' },
    }

    expect(parseCanvasDocumentNode(legacyNode)).toBeNull()
    expect(normalizeCanvasDocumentNode(legacyNode)).toBeNull()
  })

  it('parses awareness payloads used by collaborative canvas sessions', () => {
    expect(
      parseCanvasAwarenessUser({
        name: 'Remote',
        color: '#f00',
      }),
    ).toEqual({
      name: 'Remote',
      color: '#f00',
    })
    expect(
      parseCanvasDrawAwarenessState({
        points: [
          [0, 0, 0.5],
          [10, 5, 0.75],
        ],
        color: '#000',
        size: 4,
        opacity: 75,
      }),
    ).toEqual({
      points: [
        [0, 0, 0.5],
        [10, 5, 0.75],
      ],
      color: '#000',
      size: 4,
      opacity: 75,
    })
  })

  it('parses canvas edge types, edge styles, and persisted edges', () => {
    expect(parseCanvasEdgeType('bezier')).toBe('bezier')
    expect(parseCanvasEdgeStyle({ stroke: '#f00', strokeWidth: 4, opacity: 2 })).toEqual({
      stroke: '#f00',
      strokeWidth: 4,
      opacity: 1,
    })
    expect(
      parseCanvasDocumentEdge({
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'straight',
        style: { stroke: '#0f0', strokeWidth: 2 },
      }),
    ).toEqual({
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      type: 'straight',
      style: { stroke: '#0f0', strokeWidth: 2 },
    })
  })

  it('keeps renderer class names out of persisted canvas edge state', () => {
    const edgeWithRendererClass = {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      type: 'straight',
      className: 'stroke-muted',
    }

    expect(parseCanvasDocumentEdge(edgeWithRendererClass)).toBeNull()
    expect(normalizeCanvasDocumentEdge(edgeWithRendererClass)).toEqual({
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      type: 'straight',
    })
  })

  it('accepts canvas-supported rich-text blocks for text nodes', () => {
    expect(
      parseCanvasTextDocument([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello', styles: { bold: true } }],
        },
        {
          type: 'quote',
          props: { textAlignment: 'center' },
          content: [{ type: 'text', text: 'World' }],
        },
      ]),
    ).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello', styles: { bold: true } }],
      },
      {
        type: 'quote',
        props: { textAlignment: 'center' },
        content: [{ type: 'text', text: 'World' }],
      },
    ])
  })
})
