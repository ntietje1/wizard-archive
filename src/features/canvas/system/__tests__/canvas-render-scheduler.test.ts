import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvasRenderScheduler } from '../canvas-render-scheduler'
import type { CanvasDomRegistry } from '../canvas-dom-registry'

describe('createCanvasRenderScheduler', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('coalesces pending node transforms before flushing', () => {
    const node = document.createElement('div')
    const scheduler = createCanvasRenderScheduler({
      domRegistry: createDomRegistry({ nodes: new Map([['node-1', node]]) }),
    })

    scheduler.scheduleNodeTransforms(new Map([['node-1', { x: 10, y: 20 }]]))
    scheduler.scheduleNodeTransforms(new Map([['node-1', { x: 30, y: 40 }]]))
    scheduler.flush()

    expect(node.style.transform).toBe('translate(30px, 40px)')

    scheduler.destroy()
  })

  it('schedules one animation frame for rapid updates', () => {
    const requestAnimationFrame = vi.mocked(globalThis.requestAnimationFrame)
    const scheduler = createCanvasRenderScheduler({
      domRegistry: createDomRegistry(),
    })

    scheduler.scheduleNodeTransforms(new Map([['node-1', { x: 10, y: 20 }]]))
    scheduler.scheduleNodeTransforms(new Map([['node-1', { x: 30, y: 40 }]]))

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)

    scheduler.destroy()
  })

  it('cancels a pending animation frame on destroy', () => {
    const cancelAnimationFrame = vi.mocked(globalThis.cancelAnimationFrame)
    const scheduler = createCanvasRenderScheduler({
      domRegistry: createDomRegistry(),
    })

    scheduler.scheduleNodeTransforms(new Map([['node-1', { x: 10, y: 20 }]]))
    scheduler.destroy()

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
  })

  it('applies edge style patches without losing existing authored stroke width', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.style.stroke = '#111827'
    path.style.opacity = '0.5'
    path.dataset.canvasAuthoredStrokeWidth = '4'
    const scheduler = createCanvasRenderScheduler({
      domRegistry: createDomRegistry({
        edgePaths: new Map([['edge-1', { path }]]),
      }),
    })

    scheduler.scheduleEdgePatches(new Map([['edge-1', { style: { stroke: '#ef4444' } }]]))
    scheduler.flush()

    expect(path.style.stroke).toBe('rgb(239, 68, 68)')
    expect(path.style.opacity).toBe('0.5')
    expect(path.dataset.canvasAuthoredStrokeWidth).toBe('4')

    scheduler.destroy()
  })

  it('applies viewport transforms to the main viewport and overlays', () => {
    const viewport = document.createElement('div')
    const overlay = document.createElement('div')
    const scheduler = createCanvasRenderScheduler({
      domRegistry: createDomRegistry({ viewportTargets: [viewport, overlay] }),
    })

    scheduler.scheduleViewportTransform({ x: 12, y: 24, zoom: 1.5 })
    scheduler.flush()

    expect(viewport.style.transform).toBe('translate3d(12px, 24px, 0) scale(1.5)')
    expect(viewport.style.getPropertyValue('--canvas-zoom')).toBe('1.5')
    expect(overlay.style.transform).toBe('translate3d(12px, 24px, 0) scale(1.5)')
    expect(overlay.style.getPropertyValue('--canvas-zoom')).toBe('1.5')

    scheduler.destroy()
  })
})

function createDomRegistry({
  nodes = new Map(),
  edgePaths = new Map(),
  viewportTargets = [],
}: {
  nodes?: Map<string, HTMLElement>
  edgePaths?: Map<string, NonNullable<ReturnType<CanvasDomRegistry['getEdgePaths']>>>
  viewportTargets?: Array<HTMLElement>
} = {}): CanvasDomRegistry {
  return {
    registerNode: () => () => undefined,
    registerNodeSurface: () => () => undefined,
    registerStrokeNodePaths: () => () => undefined,
    registerEdge: () => () => undefined,
    registerEdgePaths: () => () => undefined,
    registerViewport: () => () => undefined,
    registerViewportOverlay: () => () => undefined,
    getNode: (nodeId) => nodes.get(nodeId),
    getNodeSurface: () => undefined,
    getStrokeNodePaths: () => undefined,
    getStrokeNodePathEntries: () => [],
    getEdge: () => undefined,
    getEdgePaths: (edgeId) => edgePaths.get(edgeId),
    getViewportTargets: () => viewportTargets,
    getViewportSurfaceBounds: () => null,
    applyCullingDiff: () => undefined,
    clear: () => undefined,
  }
}
