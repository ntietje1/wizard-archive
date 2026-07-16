import { describe, expect, it, vi } from 'vite-plus/test'
import {
  CanvasInteractionController,
  canvasToScreenPoint,
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
    controller.beginSelection('marquee', 'add')

    expect(getVisualCanvasSelection(controller.get()).nodeIds).toEqual(new Set([NODE_A]))
    controller.previewSelection({ nodeIds: new Set([NODE_B]), edgeIds: new Set(['edge-a-b']) })
    expect(getVisualCanvasSelection(controller.get())).toEqual({
      nodeIds: new Set([NODE_A, NODE_B]),
      edgeIds: new Set(['edge-a-b']),
    })

    controller.commitSelection()
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
    controller.beginSelection('lasso', 'replace')
    controller.previewSelection({ nodeIds: new Set([NODE_B]), edgeIds: new Set() })
    controller.cancelInteraction()
    expect(controller.get().selection.nodeIds).toEqual(new Set([NODE_A]))

    controller.beginSelection('marquee', 'replace')
    controller.previewSelection({ nodeIds: new Set([NODE_B]), edgeIds: new Set() })
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
    controller.beginSelection('marquee', 'add')
    controller.previewSelection({
      nodeIds: new Set([NODE_A, NODE_B]),
      edgeIds: new Set(['edge-b-c']),
    })

    controller.reconcileSelection(new Set([NODE_B]), new Set(['edge-b-c']))
    expect(controller.get().selection).toEqual({
      nodeIds: new Set([NODE_B]),
      edgeIds: new Set(['edge-b-c']),
    })
    expect(controller.get().interaction).toEqual({
      type: 'selecting',
      kind: 'marquee',
      mode: 'add',
      candidate: { nodeIds: new Set([NODE_B]), edgeIds: new Set(['edge-b-c']) },
    })
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
