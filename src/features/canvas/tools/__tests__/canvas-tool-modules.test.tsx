import { describe, expect, it, vi } from 'vitest'
import {
  canvasToolAwarenessLayers,
  canvasToolLocalOverlayLayers,
  canvasToolSpecs,
  canvasToolbarTools,
} from '../canvas-tool-modules'
import type { CanvasToolPropertyContext, CanvasToolRuntime } from '../canvas-tool-types'
import type { CanvasEdgeType } from '../../edges/canvas-edge-types'

const selectAwarenessClear = vi.hoisted(() => vi.fn())
const selectOverlayClear = vi.hoisted(() => vi.fn())
const selectCreateHandlers = vi.hoisted(() => vi.fn(() => ({ onNodeClick: vi.fn() })))
const drawAwarenessClear = vi.hoisted(() => vi.fn())
const drawOverlayClear = vi.hoisted(() => vi.fn())
const drawCreateHandlers = vi.hoisted(() => vi.fn(() => ({ onPointerDown: vi.fn() })))
const edgeCreateHandlers = vi.hoisted(() => vi.fn(() => ({ onMoveEnd: vi.fn() })))
const textCreateHandlers = vi.hoisted(() => vi.fn(() => ({ onNodeClick: vi.fn() })))
const edgeProperties = vi.hoisted(() =>
  vi.fn(() => ({ bindings: [{ definition: { id: 'edge-style' } }] })),
)

function createLayer(label: string) {
  return function Layer() {
    return label
  }
}

vi.mock('../select/select-tool-module', () => ({
  selectToolSpec: {
    id: 'select',
    label: 'Pointer',
    group: 'selection',
    icon: 'select-icon',
    awareness: {
      Layer: createLayer('select-awareness'),
      clear: selectAwarenessClear,
    },
    localOverlay: {
      Layer: createLayer('select-overlay'),
      clear: selectOverlayClear,
    },
    createHandlers: selectCreateHandlers,
  },
}))

vi.mock('../hand/hand-tool-module', () => ({
  handToolSpec: {
    id: 'hand',
    label: 'Hand',
    group: 'selection',
    icon: 'hand-icon',
    createHandlers: vi.fn(() => ({})),
  },
}))

vi.mock('../lasso/lasso-tool-module', () => ({
  lassoToolSpec: {
    id: 'lasso',
    label: 'Lasso select',
    group: 'selection',
    icon: 'lasso-icon',
    cursor: 'crosshair',
    awareness: {
      Layer: createLayer('lasso-awareness'),
    },
    localOverlay: {
      Layer: createLayer('lasso-overlay'),
      clear: vi.fn(),
    },
    createHandlers: vi.fn(() => ({})),
  },
}))

vi.mock('../draw/draw-tool-module', () => ({
  drawToolSpec: {
    id: 'draw',
    label: 'Draw',
    group: 'creation',
    icon: 'draw-icon',
    cursor: 'crosshair',
    awareness: {
      Layer: createLayer('draw-awareness'),
      clear: drawAwarenessClear,
    },
    localOverlay: {
      Layer: createLayer('draw-overlay'),
      clear: drawOverlayClear,
    },
    createHandlers: drawCreateHandlers,
  },
}))

vi.mock('../erase/erase-tool-module', () => ({
  eraseToolSpec: {
    id: 'erase',
    label: 'Erase',
    group: 'creation',
    icon: 'erase-icon',
    createHandlers: vi.fn(() => ({})),
  },
}))

vi.mock('../text/text-tool-module', () => ({
  textToolSpec: {
    id: 'text',
    label: 'Text',
    group: 'creation',
    icon: 'text-icon',
    createHandlers: textCreateHandlers,
  },
}))

vi.mock('../edge/edge-tool-module', () => ({
  edgeToolSpec: {
    id: 'edge',
    label: 'Edges',
    group: 'creation',
    icon: 'edge-icon',
    cursor: 'edge-cursor',
    properties: edgeProperties,
    createHandlers: edgeCreateHandlers,
  },
}))

function createBaseToolState() {
  return {
    getSettings: () => ({
      strokeColor: '#000',
      strokeOpacity: 1,
      strokeSize: 2,
      edgeType: 'bezier' as CanvasEdgeType,
    }),
    setEdgeType: vi.fn(),
    setStrokeColor: vi.fn(),
    setStrokeSize: vi.fn(),
    setStrokeOpacity: vi.fn(),
  }
}

function createToolPropertyContext(): CanvasToolPropertyContext {
  return {
    toolState: createBaseToolState(),
  }
}

function createToolRuntime(): CanvasToolRuntime {
  return {
    viewport: {
      screenToCanvasPosition: (position) => position,
      getZoom: () => 1,
    },
    commands: {
      createNode: vi.fn(),
      patchNodeData: vi.fn(),
      patchEdges: vi.fn(),
      resizeNode: vi.fn(),
      resizeNodes: vi.fn(),
      deleteNodes: vi.fn(),
      createEdge: vi.fn(),
      deleteEdges: vi.fn(),
      setNodePositions: vi.fn(),
    },
    query: {
      getNodes: () => [],
      getEdges: () => [],
      getMeasuredNodes: () => [],
    },
    selection: {
      getSnapshot: () => ({ nodeIds: new Set<string>(), edgeIds: new Set<string>() }),
      setSelection: vi.fn(),
      clearSelection: vi.fn(),
      toggleNode: vi.fn(),
      toggleEdge: vi.fn(),
      beginGesture: vi.fn(),
      setGesturePreview: vi.fn(),
      commitGesture: vi.fn(),
      cancelGesture: vi.fn(),
    },
    interaction: {
      suppressNextSurfaceClick: vi.fn(),
    },
    modifiers: {
      getShiftPressed: () => false,
      getPrimaryPressed: () => false,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: vi.fn(),
      pendingEditNodeId: null,
      pendingEditNodePoint: null,
      setPendingEditNodeId: vi.fn(),
      setPendingEditNodePoint: vi.fn(),
    },
    toolState: {
      ...createBaseToolState(),
      getActiveTool: () => 'select',
      setActiveTool: vi.fn(),
    },
    awareness: {
      core: {
        setLocalCursor: vi.fn(),
        setLocalResizing: vi.fn(),
        setLocalSelection: vi.fn(),
      },
      presence: {
        setPresence: vi.fn(),
      },
    },
  }
}

describe('canvas tool specs', () => {
  it('keeps the explicit toolbar order and shortcut numbering stable', () => {
    expect(canvasToolbarTools.map(({ id, shortcut }) => ({ id, shortcut }))).toEqual([
      { id: 'select', shortcut: 1 },
      { id: 'hand', shortcut: 2 },
      { id: 'lasso', shortcut: 3 },
      { id: 'draw', shortcut: 4 },
      { id: 'erase', shortcut: 5 },
      { id: 'text', shortcut: 6 },
      { id: 'edge', shortcut: 7 },
    ])
  })

  it('reads tool-specific behavior from the explicit tool spec map', () => {
    const context = createToolPropertyContext()
    const runtime = createToolRuntime()

    expect(canvasToolSpecs.draw.cursor).toBe('crosshair')
    expect(canvasToolSpecs.hand.properties).toBeUndefined()
    expect(canvasToolSpecs.edge.properties?.(context)).toEqual({
      bindings: [{ definition: { id: 'edge-style' } }],
    })
    expect(canvasToolSpecs.text.createHandlers(runtime)).toEqual({
      onNodeClick: expect.any(Function),
    })
    expect(textCreateHandlers).toHaveBeenCalledWith(runtime)
    expect(edgeProperties).toHaveBeenCalledWith(context)
  })

  it('exports awareness and local overlay layers and keeps transient clear behavior on specs', () => {
    const presence = { setPresence: vi.fn() }

    expect(canvasToolAwarenessLayers.map(({ key }) => key)).toEqual(['select', 'lasso', 'draw'])
    expect(canvasToolLocalOverlayLayers.map(({ key }) => key)).toEqual(['select', 'lasso', 'draw'])

    canvasToolSpecs.select.localOverlay?.clear()
    canvasToolSpecs.select.awareness?.clear?.(presence)
    canvasToolSpecs.draw.localOverlay?.clear()

    expect(selectOverlayClear).toHaveBeenCalledTimes(1)
    expect(selectAwarenessClear).toHaveBeenCalledWith(presence)
    expect(drawOverlayClear).toHaveBeenCalledTimes(1)
    expect(drawAwarenessClear).not.toHaveBeenCalled()
  })
})
