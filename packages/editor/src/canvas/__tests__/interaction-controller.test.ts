import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createCanvasInteractionController,
  getCanvasDrawingPoints,
  getVisualCanvasSelection,
} from '../interaction-controller'
import { canvasToScreenPoint, screenToCanvasPoint } from '../canvas-viewport'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'
import { CANVAS_WORKLOAD_LIMITS } from '../workload'
import type { CanvasDocumentContent } from '../document-contract'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')

const CONTENT: CanvasDocumentContent = {
  nodes: [
    {
      id: NODE_A,
      type: 'text',
      position: { x: 0, y: 0 },
      width: 180,
      height: 80,
      data: {},
    },
    {
      id: NODE_B,
      type: 'embed',
      position: { x: 300, y: 0 },
      width: 240,
      height: 160,
      data: {},
    },
  ],
  edges: [{ id: 'edge-a-b', source: NODE_A, target: NODE_B, type: 'straight' }],
}

const STROKE_CONTENT: CanvasDocumentContent = {
  nodes: [strokeNode(NODE_A, 0), strokeNode(NODE_B, 300)],
  edges: [],
}

function strokeNode(id: typeof NODE_A, x: number): CanvasDocumentContent['nodes'][number] {
  return {
    id,
    type: 'stroke',
    position: { x, y: 0 },
    width: 100,
    height: 20,
    data: {
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      points: [
        [0, 10, 0.5],
        [100, 10, 0.5],
      ],
      color: '#000000',
      size: 4,
    },
  }
}

function contentController(content = CONTENT) {
  return createCanvasInteractionController({ readContent: () => content })
}

describe('CanvasInteractionController selection', () => {
  it('keeps click and additive node-edge selection in one authoritative snapshot', () => {
    const controller = contentController()

    controller.selectNode(NODE_A, false)
    controller.selectNode(NODE_B, true)
    controller.selectEdge('edge-a-b', true)
    expect(controller.get().selection).toEqual({
      nodeIds: new Set([NODE_A, NODE_B]),
      edgeIds: new Set(['edge-a-b']),
    })

    controller.selectNode(NODE_A, true)
    expect(controller.get().selection).toEqual({
      nodeIds: new Set([NODE_B]),
      edgeIds: new Set(['edge-a-b']),
    })
    controller.selectEdge('edge-a-b', false)
    expect(controller.get().selection).toEqual({
      nodeIds: new Set(),
      edgeIds: new Set(['edge-a-b']),
    })
    controller.dispose()
  })

  it('models selection preview as one valid discriminated interaction', () => {
    const controller = contentController()
    controller.selectNode(NODE_A, false)
    controller.beginSelection('marquee', 'add', 1, { x: 10, y: 20 })

    expect(getVisualCanvasSelection(controller.get()).nodeIds).toEqual(new Set([NODE_A]))
    controller.updateSelection(1, { x: 400, y: 200 })
    expect(getVisualCanvasSelection(controller.get())).toEqual({
      nodeIds: new Set([NODE_A, NODE_B]),
      edgeIds: new Set(['edge-a-b']),
    })

    expect(controller.commitSelection(1)).toBe(true)
    expect(controller.get()).toMatchObject({
      selection: {
        nodeIds: new Set([NODE_A, NODE_B]),
        edgeIds: new Set(['edge-a-b']),
      },
      interaction: { type: 'idle' },
    })
    controller.dispose()
  })

  it('returns to the pointer tool after every lasso gesture', () => {
    const controller = contentController()
    controller.setTool('lasso')
    controller.beginSelection('lasso', 'replace', 1, { x: 0, y: 0 })
    controller.updateSelection(1, { x: 400, y: 0 })
    controller.updateSelection(1, { x: 400, y: 200 })

    expect(controller.commitSelection(1)).toBe(true)
    expect(controller.get()).toMatchObject({ tool: 'select', interaction: { type: 'idle' } })

    controller.setTool('lasso')
    controller.beginSelection('lasso', 'replace', 2, { x: 0, y: 0 })
    expect(controller.commitSelection(2)).toBe(false)
    expect(controller.get()).toMatchObject({ tool: 'select', interaction: { type: 'idle' } })
    controller.dispose()
  })

  it('cancels previews on escape or tool change without changing committed selection', () => {
    const controller = contentController()
    controller.selectNode(NODE_A, false)
    controller.beginSelection('lasso', 'replace', 1, { x: 0, y: 0 })
    controller.updateSelection(1, { x: 400, y: 0 })
    controller.cancelInteraction()
    expect(controller.get().selection.nodeIds).toEqual(new Set([NODE_A]))

    controller.beginSelection('marquee', 'replace', 2, { x: 0, y: 0 })
    controller.updateSelection(2, { x: 400, y: 200 })
    controller.setTool('hand')
    expect(controller.get()).toMatchObject({ tool: 'hand', interaction: { type: 'idle' } })
    expect(controller.get().selection.nodeIds).toEqual(new Set([NODE_A]))
    controller.dispose()
  })

  it('enforces empty selection throughout every creation tool state', () => {
    const controller = contentController()
    for (const tool of ['draw', 'eraser', 'text', 'edge'] as const) {
      controller.setTool('select')
      controller.selectNode(NODE_A, false)
      controller.setTool(tool)
      controller.setSelection({
        nodeIds: new Set([NODE_B]),
        edgeIds: new Set(['edge-a-b']),
      })
      controller.selectNode(NODE_A, false)
      controller.selectEdge('edge-a-b', false)
      expect(controller.get().selection).toEqual({ nodeIds: new Set(), edgeIds: new Set() })
    }
    controller.dispose()
  })

  it('prunes local committed and preview selection after document changes', () => {
    const controller = contentController()
    controller.setSelection({
      nodeIds: new Set([NODE_A, NODE_B]),
      edgeIds: new Set(['edge-a-b', 'edge-b-c']),
    })
    controller.beginSelection('marquee', 'add', 3, { x: 5, y: 10 })
    controller.updateSelection(3, { x: 400, y: 200 })

    controller.reconcileDocument(new Set([NODE_B]), new Set(['edge-b-c']))
    expect(controller.get().selection).toEqual({
      nodeIds: new Set([NODE_B]),
      edgeIds: new Set(['edge-b-c']),
    })
    expect(controller.get().interaction).toEqual({
      type: 'selecting',
      kind: 'marquee',
      pointerId: 3,
      mode: 'add',
      origin: { x: 5, y: 10 },
      current: { x: 400, y: 200 },
      candidate: { nodeIds: new Set([NODE_B]), edgeIds: new Set() },
    })
    controller.dispose()
  })
})

describe('CanvasInteractionController pointer activities', () => {
  it('owns text placement until the captured pointer commits it', () => {
    const controller = createCanvasInteractionController()
    controller.beginTextPlacement(2, { x: 100, y: 200 })
    controller.updateTextPlacement(3, { x: 180, y: 260 }, false)
    expect(controller.get().interaction).toMatchObject({
      type: 'placing-text',
      pointerId: 2,
      current: { x: 100, y: 200 },
    })
    expect(controller.commitTextPlacement(3)).toBeNull()

    controller.updateTextPlacement(2, { x: 180, y: 260 }, false)
    expect(controller.commitTextPlacement(2)).toEqual({
      x: 100,
      y: 200,
      width: 80,
      height: 60,
    })
    expect(controller.get().interaction).toEqual({ type: 'idle' })
    controller.dispose()
  })

  it('owns freehand preview and returns one constrained final stroke', () => {
    const controller = createCanvasInteractionController()
    controller.setToolSettings({
      edgeType: 'bezier',
      strokeColor: '#112233',
      strokeSize: 4,
      strokeOpacity: 60,
    })
    controller.beginDrawing(3, { x: 0, y: 0 }, 0)
    controller.updateDrawing(3, [[20, 8, 0.75]], true)
    const interaction = controller.get().interaction
    expect(interaction.type).toBe('drawing')
    if (interaction.type !== 'drawing') throw new Error('Expected drawing interaction')
    expect(getCanvasDrawingPoints(interaction)).toEqual([
      [0, 0, 0.5],
      [20, 0, 0.75],
    ])
    expect(controller.commitDrawing(3)).toEqual({
      points: [
        [0, 0, 0.5],
        [20, 0, 0.75],
      ],
      style: { color: '#112233', size: 4, opacity: 60 },
    })
    expect(controller.get().interaction).toEqual({ type: 'idle' })

    controller.beginDrawing(4, { x: 1, y: 2 }, 0.5)
    expect(controller.commitDrawing(4)).toBeNull()
    controller.dispose()
  })

  it('records a coalesced drawing batch with one published interaction snapshot', () => {
    const controller = createCanvasInteractionController()
    let publications = 0
    const unsubscribe = controller.subscribe(() => {
      publications += 1
    })
    controller.beginDrawing(5, { x: 0, y: 0 }, 0.5)
    publications = 0
    controller.updateDrawing(
      5,
      [
        [4, 2, 0.4],
        [8, 5, 0.6],
        [12, 9, 0.8],
      ],
      false,
    )

    const drawing = controller.get().interaction
    expect(drawing.type).toBe('drawing')
    if (drawing.type !== 'drawing') throw new Error('Expected drawing interaction')
    expect(drawing.rawPoints).toEqual([
      [0, 0, 0.5],
      [4, 2, 0.4],
      [8, 5, 0.6],
      [12, 9, 0.8],
    ])
    expect(publications).toBe(1)
    unsubscribe()
    controller.dispose()
  })

  it('resamples drawing events beyond the point limit into one bounded stroke', () => {
    const controller = createCanvasInteractionController()
    const eventCount = CANVAS_WORKLOAD_LIMITS.pointsPerStroke * 2
    controller.setToolSettings({
      edgeType: 'bezier',
      strokeColor: '#112233',
      strokeSize: 4,
      strokeOpacity: 60,
    })
    controller.beginDrawing(5, { x: 0, y: 0 }, 0.5)
    for (let index = 1; index <= eventCount; index += 1) {
      controller.updateDrawing(5, [[index, index, 0.5]], false)
    }

    const drawing = controller.get().interaction
    expect(drawing.type).toBe('drawing')
    if (drawing.type !== 'drawing') throw new Error('Expected drawing interaction')
    expect(drawing.sampleDistance).toBeGreaterThan(1)
    expect(drawing.rawPoints.length).toBeLessThanOrEqual(CANVAS_WORKLOAD_LIMITS.pointsPerStroke)

    const stroke = controller.commitDrawing(5)
    expect(stroke?.points.length).toBeLessThanOrEqual(CANVAS_WORKLOAD_LIMITS.pointsPerStroke)
    expect(stroke?.points[0]).toEqual([0, 0, 0.5])
    expect(stroke?.points.at(-1)).toEqual([eventCount, eventCount, 0.5])
    controller.dispose()
  })

  it('samples long lasso trails with bounded amortized point storage', () => {
    const controller = createCanvasInteractionController()
    const eventCount = CANVAS_WORKLOAD_LIMITS.gesturePoints * 2
    controller.beginSelection('lasso', 'replace', 6, { x: 0, y: 0 })
    for (let index = 1; index <= eventCount; index += 1) {
      controller.updateSelection(6, { x: index, y: index })
    }

    const lasso = controller.get().interaction
    expect(lasso.type).toBe('selecting')
    if (lasso.type !== 'selecting' || lasso.kind !== 'lasso') {
      throw new Error('Expected lasso interaction')
    }
    expect(lasso.sampleDistance).toBeGreaterThan(1)
    expect(lasso.points.length).toBeLessThanOrEqual(CANVAS_WORKLOAD_LIMITS.gesturePoints)
    expect(lasso.current).toEqual({ x: eventCount, y: eventCount })
    controller.dispose()
  })

  it('bounds eraser trails and returns only the marked canonical node ids', () => {
    const controller = contentController(STROKE_CONTENT)
    controller.beginErasing(8, { x: 50, y: -10 })
    controller.updateErasing(8, { x: 50, y: 30 })
    controller.updateErasing(8, { x: 350, y: -10 })
    controller.updateErasing(8, { x: 350, y: 30 })
    const interaction = controller.get().interaction
    expect(interaction.type).toBe('erasing')
    if (interaction.type !== 'erasing') throw new Error('Expected erasing interaction')
    expect(interaction.current).toEqual({ x: 350, y: 30 })

    controller.reconcileDocument(new Set([NODE_B]), new Set())
    expect(controller.commitErasing(8)).toEqual(new Set([NODE_B]))
    expect(controller.get().interaction).toEqual({ type: 'idle' })
    controller.dispose()
  })

  it('keeps an edge draft local and commits only a valid canonical node-handle pair', () => {
    const controller = contentController()
    controller.beginConnection(9, { nodeId: NODE_A, handle: 'right' }, { x: 10, y: 20 })
    controller.updateConnection(9, { x: 302, y: 80 })
    expect(controller.get().interaction).toMatchObject({
      type: 'connecting',
      source: { nodeId: NODE_A, handle: 'right' },
      target: { nodeId: NODE_B, handle: 'left' },
    })

    controller.reconcileDocument(new Set([NODE_A]), new Set())
    expect(controller.commitConnection(9)).toBeNull()
    expect(controller.get().interaction).toEqual({ type: 'idle' })

    controller.beginConnection(10, { nodeId: NODE_A, handle: 'bottom' }, { x: 10, y: 20 })
    controller.updateConnection(10, { x: 420, y: 2 })
    expect(controller.commitConnection(10)).toEqual({
      source: { nodeId: NODE_A, handle: 'bottom' },
      target: { nodeId: NODE_B, handle: 'top' },
    })
    controller.dispose()
  })

  it('keeps one canonical multi-node resize preview and commits its transform once', () => {
    const controller = createCanvasInteractionController()
    const initialBounds = { x: 0, y: 0, width: 480, height: 80 }
    const initialNodeBounds = new Map([
      [NODE_A, { x: 0, y: 0, width: 180, height: 80 }],
      [NODE_B, { x: 300, y: 0, width: 180, height: 80 }],
    ])
    controller.beginResize(11, 'bottom-right', initialBounds, initialNodeBounds)
    controller.updateResize(11, { x: 960, y: 160 })

    expect(controller.commitResize(11)).toEqual({
      initialBounds,
      bounds: { x: 0, y: 0, width: 960, height: 160 },
      initialNodeBounds,
    })
    expect(controller.get().interaction).toEqual({ type: 'idle' })
    controller.dispose()
  })

  it('previews a multi-node drag and commits only a non-zero delta', () => {
    const controller = createCanvasInteractionController()
    controller.beginDrag(
      4,
      { x: 100, y: 80 },
      new Map([
        [NODE_A, { x: 10, y: 20 }],
        [NODE_B, { x: 50, y: 70 }],
      ]),
    )
    controller.updateDrag(4, { x: 125, y: 110 })
    expect(controller.commitDrag(4)).toEqual(
      new Map([
        [NODE_A, { x: 35, y: 50 }],
        [NODE_B, { x: 75, y: 100 }],
      ]),
    )
    expect(controller.get().interaction).toEqual({ type: 'idle' })

    controller.beginDrag(5, { x: 0, y: 0 }, new Map([[NODE_A, { x: 10, y: 20 }]]))
    expect(controller.commitDrag(5)).toBeNull()
    controller.dispose()
  })

  it('owns pan lifecycle and commits the resulting viewport once', () => {
    const controller = createCanvasInteractionController({
      viewport: { x: 10, y: 20, zoom: 2 },
    })
    const committed = vi.fn()
    controller.subscribeViewportCommit(committed)
    controller.beginPan(7, { x: 100, y: 80 })
    controller.updatePan(7, { x: 140, y: 50 })
    expect(controller.get().viewport).toEqual({ x: 50, y: -10, zoom: 2 })
    expect(controller.commitPan(7)).toBe(true)
    expect(committed).toHaveBeenCalledWith({ x: 50, y: -10, zoom: 2 })
    controller.dispose()
  })

  it('ends editing when the edited node disappears', () => {
    const controller = createCanvasInteractionController()
    controller.editNode(NODE_A)
    controller.reconcileDocument(new Set([NODE_B]), new Set())
    expect(controller.get().interaction).toEqual({ type: 'idle' })
    controller.dispose()
  })
})

describe('CanvasInteractionController viewport', () => {
  it('normalizes viewport values and preserves a zoom center', () => {
    const controller = createCanvasInteractionController({
      viewport: {
        x: Number.NaN,
        y: Number.POSITIVE_INFINITY,
        zoom: 20,
      },
    })
    expect(controller.get().viewport).toEqual({ x: 0, y: 0, zoom: 4 })

    controller.setViewport({ x: 10, y: 20, zoom: 2 })
    controller.zoomTo(1, { x: 100, y: 80 })
    expect(controller.get().viewport).toEqual({ x: 55, y: 50, zoom: 1 })
    controller.dispose()
  })

  it('converts points exactly across viewport translation, zoom, and surface origin', () => {
    const viewport = { x: 40, y: -20, zoom: 2 }
    const origin = { x: 100, y: 50 }
    const canvasPoint = { x: 30, y: 45 }
    const screenPoint = canvasToScreenPoint(canvasPoint, viewport, origin)
    expect(screenPoint).toEqual({ x: 200, y: 120 })
    expect(screenToCanvasPoint(screenPoint, viewport, origin)).toEqual(canvasPoint)
  })

  it('publishes live viewport changes and persists only explicit commits', () => {
    const controller = createCanvasInteractionController()
    const changed = vi.fn()
    const committed = vi.fn()
    controller.subscribe(changed)
    controller.subscribeViewportCommit(committed)

    controller.panBy({ x: 40, y: -20 })
    controller.zoomTo(1.25, { x: 0, y: 0 })
    expect(changed).toHaveBeenCalledTimes(2)
    expect(committed).not.toHaveBeenCalled()

    controller.commitViewport()
    expect(committed).toHaveBeenCalledOnce()
    expect(committed).toHaveBeenCalledWith(controller.get().viewport)
    controller.dispose()
  })
})
