import { describe, expect, it, vi } from 'vite-plus/test'
import {
  canvasToScreenPoint,
  createCanvasInteractionController,
  getCanvasDrawingPoints,
  getVisualCanvasSelection,
  screenToCanvasPoint,
} from '../interaction-controller'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'
import { CANVAS_WORKLOAD_LIMITS } from '../workload'
import type { CanvasCandidateWorkBudget } from '../workload'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')

describe('CanvasInteractionController selection', () => {
  it('keeps click and additive node-edge selection in one authoritative snapshot', () => {
    const controller = createCanvasInteractionController()

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
    const controller = createCanvasInteractionController()
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
    const controller = createCanvasInteractionController()
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
    const controller = createCanvasInteractionController()
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
    const controller = createCanvasInteractionController()
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

  it('resamples tens of thousands of drawing events into one bounded stroke', () => {
    const controller = createCanvasInteractionController()
    controller.beginDrawing(5, { x: 0, y: 0 }, 0.5, {
      color: '#112233',
      size: 4,
      opacity: 60,
    })
    for (let index = 1; index <= 20_000; index += 1) {
      controller.updateDrawing(5, { x: index, y: index }, 0.5, false)
    }

    const stroke = controller.commitDrawing(5)
    expect(stroke?.points.length).toBeLessThanOrEqual(CANVAS_WORKLOAD_LIMITS.pointsPerStroke)
    expect(stroke?.points[0]).toEqual([0, 0, 0.5])
    expect(stroke?.points.at(-1)).toEqual([20_000, 20_000, 0.5])
    controller.dispose()
  })

  it('bounds eraser trails and returns only the marked canonical node ids', () => {
    const controller = createCanvasInteractionController()
    controller.beginErasing(8, { x: 0, y: 0 })
    for (let index = 1; index <= 20_000; index += 1) {
      controller.updateErasing(8, { x: index, y: index }, new Set([NODE_A, NODE_B]))
    }
    const interaction = controller.get().interaction
    expect(interaction.type).toBe('erasing')
    if (interaction.type !== 'erasing') throw new Error('Expected erasing interaction')
    expect(interaction.points.length).toBeLessThanOrEqual(CANVAS_WORKLOAD_LIMITS.gesturePoints)

    controller.reconcileDocument(new Set([NODE_B]), new Set())
    expect(controller.commitErasing(8)).toEqual(new Set([NODE_B]))
    expect(controller.get().interaction).toEqual({ type: 'idle' })
    controller.dispose()
  })

  it('keeps an edge draft local and commits only a valid canonical node-handle pair', () => {
    const controller = createCanvasInteractionController()
    controller.beginConnection(9, { nodeId: NODE_A, handle: 'right' }, { x: 10, y: 20 })
    controller.updateConnection(9, { x: 100, y: 20 }, { nodeId: NODE_B, handle: 'left' })
    expect(controller.get().interaction).toMatchObject({
      type: 'connecting',
      source: { nodeId: NODE_A, handle: 'right' },
      target: { nodeId: NODE_B, handle: 'left' },
    })

    controller.reconcileDocument(new Set([NODE_A]), new Set())
    expect(controller.commitConnection(9)).toBeNull()
    expect(controller.get().interaction).toEqual({ type: 'idle' })

    controller.beginConnection(10, { nodeId: NODE_A, handle: 'bottom' }, { x: 10, y: 20 })
    controller.updateConnection(10, { x: 100, y: 20 }, { nodeId: NODE_B, handle: 'top' })
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
    controller.updateResize(11, { x: 0, y: 0, width: 960, height: 160 })

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
    controller.updateDrag(4, { x: 25, y: 30 })
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

  it('shares one bounded candidate-work budget for every update in each geometry gesture', () => {
    const controller = createCanvasInteractionController()
    const startedAt = performance.now()
    const gestureBudgets = new Set<CanvasCandidateWorkBudget>()
    const exercise = (pointerId: number, update: (index: number, exhausted: boolean) => void) => {
      let firstBudget: CanvasCandidateWorkBudget | null = null
      let lastBudget: CanvasCandidateWorkBudget | null = null
      for (let index = 1; index <= 20_000; index += 1) {
        const budget = controller.withCandidateWork(pointerId, (current) => {
          current.consume()
          return current
        })
        if (!budget) throw new Error('Expected active gesture candidate-work budget')
        firstBudget ??= budget
        lastBudget = budget
        update(index, budget.exhausted)
      }
      if (!lastBudget) throw new Error('Expected candidate-work updates')
      expect(lastBudget).toBe(firstBudget)
      expect(lastBudget.exhausted).toBe(true)
      expect(lastBudget.remaining).toBe(0)
      expect(controller.withCandidateWork(pointerId, (budget) => budget)).toBe(lastBudget)
      gestureBudgets.add(lastBudget)
    }

    controller.beginDrag(20, { x: 0, y: 0 }, new Map([[NODE_A, { x: 10, y: 20 }]]))
    exercise(20, (index) => controller.updateDrag(20, { x: index, y: index }))
    expect(controller.commitDrag(20)).toEqual(new Map([[NODE_A, { x: 20_010, y: 20_020 }]]))

    const initialBounds = { x: 0, y: 0, width: 180, height: 80 }
    controller.beginResize(21, 'bottom-right', initialBounds, new Map([[NODE_A, initialBounds]]))
    exercise(21, (index) =>
      controller.updateResize(21, { ...initialBounds, width: 180 + index, height: 80 + index }),
    )
    expect(controller.commitResize(21)?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 20_180,
      height: 20_080,
    })

    controller.setSelection({ nodeIds: new Set([NODE_A]), edgeIds: new Set() })
    controller.beginSelection('lasso', 'replace', 22, { x: 0, y: 0 })
    exercise(22, (index, exhausted) =>
      controller.updateSelection(
        22,
        { x: index, y: index },
        exhausted ? null : { nodeIds: new Set([NODE_B]), edgeIds: new Set() },
      ),
    )
    const lasso = controller.get().interaction
    expect(lasso.type).toBe('selecting')
    if (lasso.type !== 'selecting' || lasso.kind !== 'lasso') {
      throw new Error('Expected lasso interaction')
    }
    expect(lasso.points.length).toBeLessThanOrEqual(CANVAS_WORKLOAD_LIMITS.gesturePoints)
    expect(controller.commitSelection(22)).toBe(false)
    expect(controller.get().selection.nodeIds).toEqual(new Set([NODE_A]))

    controller.beginErasing(23, { x: 0, y: 0 })
    exercise(23, (index) => controller.updateErasing(23, { x: index, y: index }, new Set([NODE_A])))
    const erasing = controller.get().interaction
    expect(erasing.type).toBe('erasing')
    if (erasing.type !== 'erasing') throw new Error('Expected erasing interaction')
    expect(erasing.points.length).toBeLessThanOrEqual(CANVAS_WORKLOAD_LIMITS.gesturePoints)
    expect(controller.commitErasing(23)).toEqual(new Set([NODE_A]))

    controller.beginConnection(24, { nodeId: NODE_A, handle: 'right' }, { x: 0, y: 0 })
    exercise(24, (index, exhausted) =>
      controller.updateConnection(
        24,
        { x: index, y: index },
        exhausted ? null : { nodeId: NODE_B, handle: 'left' },
      ),
    )
    expect(controller.commitConnection(24)).toBeNull()
    expect(gestureBudgets.size).toBe(5)
    expect(performance.now() - startedAt).toBeLessThan(5_000)
    controller.dispose()
  }, 10_000)

  it('owns pan lifecycle and commits the resulting viewport once', () => {
    const controller = createCanvasInteractionController({ x: 10, y: 20, zoom: 2 })
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
