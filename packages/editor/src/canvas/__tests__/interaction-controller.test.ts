import { describe, expect, it, vi } from 'vite-plus/test'
import {
  CanvasInteractionController,
  canvasToScreenPoint,
  getCanvasDrawingPoints,
  getVisualCanvasSelection,
  screenToCanvasPoint,
} from '../interaction-controller'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')

describe('CanvasInteractionController selection', () => {
  it('keeps click and additive node-edge selection in one authoritative snapshot', () => {
    const controller = new CanvasInteractionController()

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
    const controller = new CanvasInteractionController()
    controller.selectNode(NODE_A, false)
    controller.beginSelection('marquee', 'add', 1, { x: 10, y: 20 })

    expect(getVisualCanvasSelection(controller.get()).nodeIds).toEqual(new Set([NODE_A]))
    controller.updateSelection(
      1,
      { x: 50, y: 60 },
      {
        nodeIds: new Set([NODE_B]),
        edgeIds: new Set(['edge-a-b']),
      },
    )
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

  it('cancels previews on escape or tool change without changing committed selection', () => {
    const controller = new CanvasInteractionController()
    controller.selectNode(NODE_A, false)
    controller.beginSelection('lasso', 'replace', 1, { x: 0, y: 0 })
    controller.updateSelection(
      1,
      { x: 10, y: 0 },
      {
        nodeIds: new Set([NODE_B]),
        edgeIds: new Set(),
      },
    )
    controller.cancelInteraction()
    expect(controller.get().selection.nodeIds).toEqual(new Set([NODE_A]))

    controller.beginSelection('marquee', 'replace', 2, { x: 0, y: 0 })
    controller.updateSelection(
      2,
      { x: 10, y: 10 },
      {
        nodeIds: new Set([NODE_B]),
        edgeIds: new Set(),
      },
    )
    controller.setTool('hand')
    expect(controller.get()).toMatchObject({ tool: 'hand', interaction: { type: 'idle' } })
    expect(controller.get().selection.nodeIds).toEqual(new Set([NODE_A]))
    controller.dispose()
  })

  it('prunes local committed and preview selection after document changes', () => {
    const controller = new CanvasInteractionController()
    controller.setSelection({
      nodeIds: new Set([NODE_A, NODE_B]),
      edgeIds: new Set(['edge-a-b', 'edge-b-c']),
    })
    controller.beginSelection('marquee', 'add', 3, { x: 5, y: 10 })
    controller.updateSelection(
      3,
      { x: 15, y: 20 },
      {
        nodeIds: new Set([NODE_A, NODE_B]),
        edgeIds: new Set(['edge-b-c']),
      },
    )

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
      current: { x: 15, y: 20 },
      candidate: { nodeIds: new Set([NODE_B]), edgeIds: new Set(['edge-b-c']) },
    })
    controller.dispose()
  })
})

describe('CanvasInteractionController pointer activities', () => {
  it('owns freehand preview and returns one constrained final stroke', () => {
    const controller = new CanvasInteractionController()
    controller.beginDrawing(3, { x: 0, y: 0 }, 0, {
      color: '#112233',
      size: 4,
      opacity: 60,
    })
    controller.updateDrawing(3, { x: 20, y: 8 }, 0.75, true)
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

    controller.beginDrawing(4, { x: 1, y: 2 }, 0.5, {
      color: '#112233',
      size: 4,
      opacity: 60,
    })
    expect(controller.commitDrawing(4)).toBeNull()
    controller.dispose()
  })

  it('previews a multi-node drag and commits only a non-zero delta', () => {
    const controller = new CanvasInteractionController()
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
    const controller = new CanvasInteractionController({ x: 10, y: 20, zoom: 2 })
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
    const controller = new CanvasInteractionController()
    controller.editNode(NODE_A)
    controller.reconcileDocument(new Set([NODE_B]), new Set())
    expect(controller.get().interaction).toEqual({ type: 'idle' })
    controller.dispose()
  })
})

describe('CanvasInteractionController viewport', () => {
  it('normalizes viewport values and preserves a zoom center', () => {
    const controller = new CanvasInteractionController({
      x: Number.NaN,
      y: Number.POSITIVE_INFINITY,
      zoom: 20,
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
    const controller = new CanvasInteractionController()
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
