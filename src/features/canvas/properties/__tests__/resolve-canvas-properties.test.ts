import { assert, describe, expect, it, vi } from 'vitest'
import {
  getSharedSelectedEdgeType,
  resolveCanvasSelectionProperties,
} from '../resolve-canvas-selection-properties'
import { resolveCanvasProperties } from '../resolve-canvas-properties'
import { bindCanvasPaintProperty, bindCanvasStrokeSizeProperty } from '../canvas-property-types'
import {
  linePaintCanvasProperty,
  lineStrokeSizeCanvasProperty,
  textColorCanvasProperty,
} from '../canvas-property-definitions'
import { createEmptyCanvasRichTextContent } from '../../nodes/shared/canvas-rich-text-editor'
import { normalizeCanvasNodeSurfaceStyleData } from '../../nodes/shared/canvas-node-surface-style'
import type { CanvasRichTextFormattingSnapshot } from '../../nodes/shared/canvas-rich-text-formatting-session'
import type {
  CanvasPaintPropertyDefinition,
  CanvasStrokeSizeResolvedProperty,
  CanvasStrokeSizePropertyDefinition,
} from '../canvas-property-types'
import type { CanvasToolPropertyContext } from '../../tools/canvas-tool-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../types/canvas-domain-types'

const testPaintProperty: CanvasPaintPropertyDefinition = {
  id: 'fill',
  kind: 'paint',
  label: 'Fill',
  defaultValue: { color: '#ffffff', opacity: 100 },
  options: [
    { label: 'Default', value: { color: '#ffffff', opacity: 100 } },
    { label: 'Clear', value: { color: '#ffffff', opacity: 0 } },
    { label: 'Red', value: { color: '#ff0000', opacity: 100 } },
  ],
}

const testStrokeSizeProperty: CanvasStrokeSizePropertyDefinition = {
  id: 'strokeSize',
  kind: 'strokeSize',
  label: 'Stroke size',
  options: [1, 2, 4, 8],
  min: 0,
  max: 99,
}

describe('resolveCanvasProperties', () => {
  it('treats equivalent rgb values with the same opacity as a shared paint value', () => {
    const properties = resolveCanvasProperties([
      {
        bindings: [
          bindCanvasPaintProperty(testPaintProperty, {
            getColor: () => '#ff0000',
            setColor: () => {},
            getOpacity: () => 75,
            setOpacity: () => {},
          }),
        ],
      },
      {
        bindings: [
          bindCanvasPaintProperty(testPaintProperty, {
            getColor: () => 'rgb(255, 0, 0)',
            setColor: () => {},
            getOpacity: () => 75,
            setOpacity: () => {},
          }),
        ],
      },
    ])

    expect(properties).toHaveLength(1)
    assert(properties[0]?.definition.kind === 'paint')
    expect(properties[0].value).toEqual({
      kind: 'value',
      value: {
        color: '#ff0000',
        opacity: 75,
      },
    })
  })

  it('treats matching colors with different opacity as mixed', () => {
    const properties = resolveCanvasProperties([
      {
        bindings: [
          bindCanvasPaintProperty(testPaintProperty, {
            getColor: () => '#ff0000',
            setColor: () => {},
            getOpacity: () => 0,
            setOpacity: () => {},
          }),
        ],
      },
      {
        bindings: [
          bindCanvasPaintProperty(testPaintProperty, {
            getColor: () => '#ff0000',
            setColor: () => {},
            getOpacity: () => 100,
            setOpacity: () => {},
          }),
        ],
      },
    ])

    expect(properties).toHaveLength(1)
    assert(properties[0]?.definition.kind === 'paint')
    expect(properties[0].value).toEqual({ kind: 'mixed' })
  })

  it('resolves numeric properties through the shared typed binding contract', () => {
    const setValue = vi.fn()
    const properties = resolveCanvasProperties([
      {
        bindings: [bindCanvasStrokeSizeProperty(testStrokeSizeProperty, () => 4, setValue)],
      },
      {
        bindings: [bindCanvasStrokeSizeProperty(testStrokeSizeProperty, () => 4, setValue)],
      },
    ])

    expect(properties).toHaveLength(1)
    const strokeSizeProperty = properties[0]
    assert(strokeSizeProperty?.definition.kind === 'strokeSize')
    const resolvedStrokeSizeProperty = strokeSizeProperty as CanvasStrokeSizeResolvedProperty

    expect(resolvedStrokeSizeProperty.value).toEqual({ kind: 'value', value: 4 })

    resolvedStrokeSizeProperty.setValue(6)
    expect(setValue).toHaveBeenCalledTimes(2)
    expect(setValue).toHaveBeenCalledWith(6)
  })

  it('keeps stroke-size bindings mixed when selected values differ', () => {
    const properties = resolveCanvasProperties([
      {
        bindings: [
          bindCanvasStrokeSizeProperty(
            testStrokeSizeProperty,
            () => 2,
            () => {},
          ),
        ],
      },
      {
        bindings: [
          bindCanvasStrokeSizeProperty(
            testStrokeSizeProperty,
            () => 8,
            () => {},
          ),
        ],
      },
    ])

    expect(properties).toHaveLength(1)
    assert(properties[0]?.definition.kind === 'strokeSize')
    expect(properties[0].value).toEqual({ kind: 'mixed' })
  })
})

describe('resolveCanvasSelectionProperties', () => {
  it('includes text color for selected text nodes', () => {
    const properties = resolveCanvasSelectionProperties({
      activeFormattingSnapshot: null,
      activeTool: 'select',
      isNoteEmbed: () => false,
      patchEdge: vi.fn(),
      patchNodeData: vi.fn(),
      selectedEdges: [],
      selectedNodes: [createTextNode({ textColor: 'var(--t-red)' })],
      toolPropertyContext: createToolPropertyContext(),
    })

    const textColor = properties.find(
      (property) => property.definition.id === textColorCanvasProperty.id,
    )

    assert(textColor?.definition.kind === 'paint')
    expect(textColor.value).toEqual({
      kind: 'value',
      value: { color: 'var(--t-red)', opacity: 100 },
    })
  })

  it('uses active rich-text formatting instead of the node text color binding', () => {
    const properties = resolveCanvasSelectionProperties({
      activeFormattingSnapshot: createFormattingSnapshot({
        nodeId: 'text-1',
        textColor: 'var(--t-blue)',
      }),
      activeTool: 'select',
      isNoteEmbed: () => false,
      patchEdge: vi.fn(),
      patchNodeData: vi.fn(),
      selectedEdges: [],
      selectedNodes: [createTextNode({ id: 'text-1', textColor: 'var(--t-red)' })],
      toolPropertyContext: createToolPropertyContext(),
    })

    const textColor = properties.find(
      (property) => property.definition.id === textColorCanvasProperty.id,
    )

    assert(textColor?.definition.kind === 'paint')
    expect(textColor.value).toEqual({
      kind: 'value',
      value: { color: 'var(--t-blue)', opacity: 100 },
    })
  })

  it('resolves edge tool defaults when there is no selection and the edge tool is active', () => {
    const properties = resolveCanvasSelectionProperties({
      activeFormattingSnapshot: null,
      activeTool: 'edge',
      isNoteEmbed: () => false,
      patchEdge: vi.fn(),
      patchNodeData: vi.fn(),
      selectedEdges: [],
      selectedNodes: [],
      toolPropertyContext: createToolPropertyContext({
        strokeColor: 'var(--t-green)',
        strokeOpacity: 75,
        strokeSize: 6,
      }),
    })

    expect(properties.map((property) => property.definition.id)).toEqual([
      linePaintCanvasProperty.id,
      lineStrokeSizeCanvasProperty.id,
    ])

    const linePaint = properties.find(
      (property) => property.definition.id === linePaintCanvasProperty.id,
    )
    const strokeSize = properties.find(
      (property) => property.definition.id === lineStrokeSizeCanvasProperty.id,
    )

    assert(linePaint?.definition.kind === 'paint')
    assert(strokeSize?.definition.kind === 'strokeSize')
    expect(linePaint.value).toEqual({
      kind: 'value',
      value: { color: 'var(--t-green)', opacity: 75 },
    })
    expect(strokeSize.value).toEqual({ kind: 'value', value: 6 })
  })
})

describe('getSharedSelectedEdgeType', () => {
  it('returns the shared edge type when selected edges match', () => {
    expect(
      getSharedSelectedEdgeType([
        createEdge({ id: 'edge-1', type: 'bezier' }),
        createEdge({ id: 'edge-2', type: 'bezier' }),
      ]),
    ).toBe('bezier')
  })

  it('returns the edge type for a single selected edge', () => {
    expect(getSharedSelectedEdgeType([createEdge({ id: 'edge-1', type: 'step' })])).toBe('step')
  })

  it('returns null when no edges are selected', () => {
    expect(getSharedSelectedEdgeType([])).toBeNull()
  })

  it('returns null for mixed selected edge types', () => {
    expect(
      getSharedSelectedEdgeType([
        createEdge({ id: 'edge-1', type: 'bezier' }),
        createEdge({ id: 'edge-2', type: 'straight' }),
      ]),
    ).toBeNull()
  })
})

function createTextNode({
  id = 'text-1',
  textColor = 'var(--foreground)',
}: {
  id?: string
  textColor?: string
} = {}): CanvasDocumentNode {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0 },
    width: 120,
    height: 80,
    data: {
      ...normalizeCanvasNodeSurfaceStyleData({ textColor }),
      content: createEmptyCanvasRichTextContent(),
    },
  } as CanvasDocumentNode
}

function createEdge({
  id,
  type,
}: {
  id: string
  type: CanvasDocumentEdge['type']
}): CanvasDocumentEdge {
  return {
    id,
    source: 'node-1',
    target: 'node-2',
    type,
    sourceHandle: null,
    targetHandle: null,
    style: {},
  }
}

function createFormattingSnapshot({
  nodeId,
  textColor,
}: {
  nodeId: string
  textColor: string
}): CanvasRichTextFormattingSnapshot {
  return {
    defaultTextColor: 'var(--foreground)',
    editor: {
      addStyles: vi.fn(),
      focus: vi.fn(),
    },
    hasTextSelection: true,
    nodeId,
    revision: 0,
    selectionSnapshot: null,
    setDefaultTextColor: vi.fn(),
    textColorValue: {
      kind: 'value',
      value: { color: textColor, opacity: 100 },
    },
  } as unknown as CanvasRichTextFormattingSnapshot
}

function createToolPropertyContext(
  settings: {
    strokeColor?: string
    strokeOpacity?: number
    strokeSize?: number
  } = {},
): CanvasToolPropertyContext {
  return {
    toolState: {
      getSettings: () => ({
        edgeType: 'bezier',
        strokeColor: settings.strokeColor ?? 'var(--foreground)',
        strokeOpacity: settings.strokeOpacity ?? 100,
        strokeSize: settings.strokeSize ?? 2,
      }),
      setEdgeType: vi.fn(),
      setStrokeColor: vi.fn(),
      setStrokeOpacity: vi.fn(),
      setStrokeSize: vi.fn(),
    },
  }
}
