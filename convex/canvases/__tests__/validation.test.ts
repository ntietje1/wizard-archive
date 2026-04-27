import { describe, expect, it } from 'vitest'
import {
  parseCanvasAwarenessUser,
  parseCanvasAwarenessPresence,
  parseCanvasBounds,
  parseCanvasBoundsDimensions,
  parseCanvasDrawAwarenessState,
  parseCanvasEdgeStyle,
  parseCanvasEdgeType,
  parseCanvasEmbedNodeData,
  parseCanvasLockedAspectRatio,
  parseCanvasLassoAwarenessState,
  parseCanvasNodeDataByType,
  parseCanvasNodeBorderWidth,
  parseCanvasNodeSurfaceColor,
  parseCanvasNodeSurfaceOpacity,
  parseCanvasPoint2D,
  parseCanvasRichTextContent,
  parseCanvasResizingAwarenessState,
  parseCanvasRuntimeEdge,
  parseCanvasRuntimeNode,
  parseCanvasSelectionAwarenessState,
  parseCanvasSelectAwarenessState,
  parseCanvasSidebarItemId,
  parseCanvasStrokeSelectionData,
  parseCanvasStrokeNodeData,
  parseCanvasTextNodeData,
  parsePersistedCanvasNode,
  parsePersistedCanvasViewport,
} from '../validation'

describe('parsePersistedCanvasViewport', () => {
  it('returns the parsed viewport for finite coordinates', () => {
    expect(parsePersistedCanvasViewport({ x: 42, y: -18, zoom: 1.75 })).toEqual({
      x: 42,
      y: -18,
      zoom: 1.75,
    })
  })

  it('rejects invalid viewport payloads', () => {
    expect(parsePersistedCanvasViewport({ x: 'bad', y: 0, zoom: 1 })).toBeNull()
  })
})

describe('parsePersistedCanvasNode', () => {
  it('preserves non-ephemeral node fields while validating the required shape', () => {
    expect(
      parsePersistedCanvasNode({
        id: 'node-1',
        type: 'text',
        position: { x: 10, y: 20 },
        data: { label: 'Hello' },
        width: 120,
        height: 36,
        zIndex: 7,
      }),
    ).toEqual({
      id: 'node-1',
      type: 'text',
      position: { x: 10, y: 20 },
      data: { label: 'Hello' },
      width: 120,
      height: 36,
      zIndex: 7,
    })
  })

  it('rejects nodes with invalid persisted coordinates', () => {
    expect(
      parsePersistedCanvasNode({
        id: 'node-1',
        position: { x: Number.NaN, y: 20 },
        data: {},
      }),
    ).toBeNull()
  })
})

describe('canvas node value parsers', () => {
  it('accepts valid sidebar item ids and positive aspect ratios', () => {
    expect(parseCanvasSidebarItemId('sidebar-1')).toBe('sidebar-1')
    expect(parseCanvasLockedAspectRatio(1.5)).toBe(1.5)
  })

  it('rejects invalid sidebar item ids', () => {
    expect(parseCanvasSidebarItemId('')).toBeUndefined()
  })

  it('rejects invalid aspect ratios', () => {
    expect(parseCanvasLockedAspectRatio(0)).toBeUndefined()
  })

  it('keeps surface colors', () => {
    expect(parseCanvasNodeSurfaceColor('var(--border)')).toBe('var(--border)')
    expect(parseCanvasNodeSurfaceColor(null)).toBeNull()
  })

  it('clamps bounded surface values', () => {
    expect(parseCanvasNodeSurfaceOpacity(125)).toBe(100)
    expect(parseCanvasNodeSurfaceOpacity(-5)).toBe(0)
    expect(parseCanvasNodeBorderWidth(150)).toBe(99)
  })
})

describe('parseCanvasStrokeNodeData', () => {
  it('parses valid stroke node payloads', () => {
    expect(
      parseCanvasStrokeNodeData({
        color: '#000',
        size: 4,
        opacity: 75,
        bounds: { x: 0, y: 0, width: 20, height: 10 },
        points: [
          [0, 0, 0.5],
          [10, 5, 0.5],
        ],
      }),
    ).toEqual({
      color: '#000',
      size: 4,
      opacity: 75,
      bounds: { x: 0, y: 0, width: 20, height: 10 },
      points: [
        [0, 0, 0.5],
        [10, 5, 0.5],
      ],
    })
  })

  it('rejects stroke payloads with empty points', () => {
    expect(
      parseCanvasStrokeNodeData({
        color: '#000',
        size: 4,
        bounds: { x: 0, y: 0, width: 20, height: 10 },
        points: [],
      }),
    ).toBeNull()
  })

  it('clamps stroke payload opacity into the supported range', () => {
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
  })
})

describe('canvas runtime node parsers', () => {
  it('parses embed and text node data through shared runtime helpers', () => {
    expect(
      parseCanvasEmbedNodeData({
        sidebarItemId: 'sidebar-1',
        lockedAspectRatio: 1.25,
        backgroundOpacity: 120,
      }),
    ).toEqual({
      sidebarItemId: 'sidebar-1',
      lockedAspectRatio: 1.25,
      backgroundOpacity: 100,
    })

    expect(
      parseCanvasTextNodeData({
        content: [{ type: 'paragraph' }],
        borderWidth: 200,
      }),
    ).toEqual({
      content: [{ type: 'paragraph' }],
      borderWidth: 99,
    })

    expect(
      parseCanvasNodeDataByType('embed', {
        sidebarItemId: 'sidebar-1',
      }),
    ).toEqual({
      sidebarItemId: 'sidebar-1',
    })
  })

  it('parses runtime nodes by validated type and rejects malformed node data', () => {
    expect(
      parseCanvasRuntimeNode({
        id: 'embed-1',
        type: 'embed',
        position: { x: 10, y: 20 },
        data: {
          sidebarItemId: 'sidebar-1',
          borderWidth: 10,
        },
      }),
    ).toEqual({
      id: 'embed-1',
      type: 'embed',
      position: { x: 10, y: 20 },
      data: {
        sidebarItemId: 'sidebar-1',
        borderWidth: 10,
      },
    })

    expect(
      parseCanvasRuntimeNode({
        id: 'stroke-1',
        type: 'stroke',
        position: { x: 10, y: 20 },
        data: {
          points: [[0, 0, 'bad']],
          size: 4,
          color: '#000',
          bounds: { x: 0, y: 0, width: 10, height: 10 },
        },
      }),
    ).toBeNull()
  })
})

describe('canvas geometry parsers', () => {
  it('parses valid bounds, bounds dimensions, and stroke-selection payloads', () => {
    expect(parseCanvasBounds({ x: 1, y: 2, width: 3, height: 4 })).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    })
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

  it('rejects malformed bounds and stroke-selection payloads', () => {
    expect(parseCanvasBounds({ x: 1, y: 2, width: 'bad', height: 4 })).toBeNull()
    expect(parseCanvasBoundsDimensions({ width: 30 })).toBeNull()
    expect(
      parseCanvasStrokeSelectionData({
        points: [[0, 0, 'bad']],
        size: 4,
        bounds: { x: 0, y: 0, width: 10, height: 10 },
      }),
    ).toBeNull()
  })
})

describe('canvas awareness parsers', () => {
  it('parses valid point awareness payloads', () => {
    expect(parseCanvasPoint2D({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
  })

  it('parses valid draw awareness payloads', () => {
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

  it('parses valid select awareness payloads', () => {
    expect(
      parseCanvasSelectAwarenessState({
        type: 'rect',
        x: 10,
        y: 20,
        width: 30,
        height: 40,
      }),
    ).toEqual({
      type: 'rect',
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
  })

  it('parses valid lasso awareness payloads', () => {
    expect(
      parseCanvasLassoAwarenessState({
        type: 'lasso',
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 40 },
        ],
      }),
    ).toEqual({
      type: 'lasso',
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ],
    })
  })

  it('parses valid resizing and selection awareness payloads', () => {
    expect(
      parseCanvasResizingAwarenessState({
        'node-1': { x: 10, y: 20, width: 30, height: 40 },
      }),
    ).toEqual({
      'node-1': { x: 10, y: 20, width: 30, height: 40 },
    })
    expect(parseCanvasSelectionAwarenessState(['node-1', 'node-2'])).toEqual(['node-1', 'node-2'])
  })

  it('parses valid user and presence awareness payloads', () => {
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
      parseCanvasAwarenessPresence({
        'core.cursor': { x: 10, y: 20 },
        'tool.draw': { color: '#000' },
      }),
    ).toEqual({
      'core.cursor': { x: 10, y: 20 },
      'tool.draw': { color: '#000' },
    })
  })

  it('rejects malformed awareness payloads', () => {
    expect(parseCanvasPoint2D({ x: 'bad', y: 20 })).toBeNull()
    expect(parseCanvasAwarenessUser({ name: 'Remote', color: 42 })).toBeNull()
    expect(parseCanvasAwarenessPresence('bad')).toBeNull()
    expect(
      parseCanvasDrawAwarenessState({
        points: [],
        color: '#000',
        size: 4,
        opacity: 75,
      }),
    ).toBeNull()
    expect(
      parseCanvasDrawAwarenessState({
        points: [[0, 0, 'bad']],
        color: '#000',
        size: 4,
        opacity: 75,
      }),
    ).toBeNull()
  })

  it('clamps draw awareness opacity into the supported range', () => {
    expect(
      parseCanvasDrawAwarenessState({
        points: [[0, 0, 0.5]],
        color: '#000',
        size: 4,
        opacity: 200,
      }),
    ).toEqual({
      points: [[0, 0, 0.5]],
      color: '#000',
      size: 4,
      opacity: 100,
    })
  })

  it('rejects malformed select, lasso, dragging, resizing, and selection awareness payloads', () => {
    expect(
      parseCanvasSelectAwarenessState({
        type: 'rect',
        x: 10,
        y: 20,
        width: -1,
        height: 40,
      }),
    ).toBeNull()
    expect(
      parseCanvasLassoAwarenessState({
        type: 'lasso',
        points: [{ x: 0 }],
      }),
    ).toBeNull()
    expect(
      parseCanvasResizingAwarenessState({
        'node-1': { x: 10, y: 20, width: -1, height: 40 },
      }),
    ).toBeNull()
    expect(parseCanvasSelectionAwarenessState(['node-1', 2])).toBeNull()
  })
})

describe('canvas edge parsers', () => {
  it('parses supported edge types, styles, and runtime edge payloads', () => {
    expect(parseCanvasEdgeType('bezier')).toBe('bezier')
    expect(parseCanvasEdgeStyle({ stroke: '#f00', strokeWidth: 4, opacity: 2 })).toEqual({
      stroke: '#f00',
      strokeWidth: 4,
      opacity: 1,
    })
    expect(
      parseCanvasRuntimeEdge({
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

  it('rejects malformed edge contracts', () => {
    expect(parseCanvasEdgeType('curved')).toBeNull()
    expect(parseCanvasEdgeStyle({ strokeWidth: -1 })).toEqual({})
    expect(
      parseCanvasRuntimeEdge({
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'curved',
      }),
    ).toBeNull()
  })
})

describe('parseCanvasRichTextContent', () => {
  it('accepts canvas-supported rich-text blocks and rejects excluded block types', () => {
    expect(
      parseCanvasRichTextContent([
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

    expect(
      parseCanvasRichTextContent([
        {
          type: 'table',
          props: { textColor: 'default' },
          content: {
            type: 'tableContent',
            columnWidths: [100],
            rows: [{ cells: [[{ type: 'text', text: 'Bad' }]] }],
          },
        },
      ]),
    ).toBeNull()
  })
})
