import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createCanvasRenderScheduler } from '../canvas-render-scheduler'
import { getCachedStrokeDetailPath } from '../../nodes/stroke/stroke-path-cache'
import { getStrokeHighlightPathSize } from '../../nodes/stroke/stroke-node-interactions'
import type { CanvasDomRegistry } from '../canvas-dom-registry'
import type { StrokeNodeData } from '../../nodes/stroke/stroke-node-model'

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

  it('applies moving camera state synchronously', () => {
    const requestAnimationFrame = vi.mocked(globalThis.requestAnimationFrame)
    const viewport = document.createElement('div')
    const scheduler = createCanvasRenderScheduler({
      domRegistry: createDomRegistry({ viewportTargets: [viewport] }),
    })

    scheduler.scheduleCameraState('moving')

    expect(viewport).toHaveAttribute('data-camera-state', 'moving')
    expect(viewport.style.willChange).toBe('transform')
    expect(requestAnimationFrame).not.toHaveBeenCalled()

    scheduler.destroy()
  })

  it('refreshes registered stroke paths when viewport zoom changes', () => {
    const viewport = document.createElement('div')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const highlightPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const strokeData: StrokeNodeData = {
      points: [
        [0, 0, 0.5],
        [24, 0, 0.5],
      ],
      bounds: { x: 0, y: 0, width: 24, height: 1 },
      color: 'var(--foreground)',
      size: 1,
    }
    const scheduler = createCanvasRenderScheduler({
      domRegistry: createDomRegistry({
        strokePathEntries: [['stroke-1', { path, highlightPath, data: strokeData }]],
        viewportTargets: [viewport],
      }),
    })

    scheduler.scheduleViewportTransform({ x: 0, y: 0, zoom: 0.25 })
    scheduler.flush()

    expect(path.getAttribute('d')).toBe(getCachedStrokeDetailPath('stroke-1', strokeData, 4))
    expect(highlightPath.getAttribute('d')).toBe(
      getCachedStrokeDetailPath('stroke-1', strokeData, getStrokeHighlightPathSize(1, 0.25)),
    )

    scheduler.destroy()
  })

  it('coalesces node data patches and refreshes stroke paths during the same flush', () => {
    const surface = document.createElement('div')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const highlightPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const strokeData: StrokeNodeData = {
      points: [
        [0, 0, 0.5],
        [24, 0, 0.5],
      ],
      bounds: { x: 0, y: 0, width: 24, height: 1 },
      color: '#111827',
      opacity: 50,
      size: 8,
    }
    const scheduler = createCanvasRenderScheduler({
      domRegistry: createDomRegistry({
        nodeSurfaces: new Map([['surface-1', surface]]),
        strokePaths: new Map([['stroke-1', { path, highlightPath }]]),
      }),
    })

    scheduler.scheduleNodeDataPatches(
      new Map([['surface-1', { backgroundColor: '#ff0000', borderWidth: 2 }]]),
    )
    scheduler.scheduleNodeDataPatches(new Map([['stroke-1', strokeData]]))
    scheduler.flush()

    expect(surface.style.backgroundColor).toBe('rgb(255, 0, 0)')
    expect(surface.style.borderWidth).toBe(
      'max(2px, calc(1px / max(var(--canvas-zoom, 1), 0.0001)))',
    )
    expect(path.getAttribute('d')).toBe(getCachedStrokeDetailPath('stroke-1', strokeData, 8))
    expect(path.getAttribute('fill')).toBe('#111827')
    expect(path.getAttribute('opacity')).toBe('0.5')
    expect(highlightPath.getAttribute('d')).toBeTruthy()

    scheduler.destroy()
  })

  it('coalesces culling diffs before mutating registered elements', () => {
    const applyCullingDiff = vi.fn()
    const scheduler = createCanvasRenderScheduler({
      domRegistry: createDomRegistry({ applyCullingDiff }),
    })

    scheduler.scheduleCullingDiff({
      nodeIds: new Map([['node-1', true]]),
      edgeIds: new Map([['edge-1', true]]),
    })
    scheduler.scheduleCullingDiff({
      nodeIds: new Map([['node-1', false]]),
      edgeIds: new Map([['edge-2', true]]),
    })
    scheduler.flush()

    expect(applyCullingDiff).toHaveBeenCalledTimes(1)
    expect(applyCullingDiff).toHaveBeenCalledWith({
      nodeIds: new Map([['node-1', false]]),
      edgeIds: new Map([
        ['edge-1', true],
        ['edge-2', true],
      ]),
    })

    scheduler.destroy()
  })
})

function createDomRegistry({
  nodes = new Map(),
  nodeSurfaces = new Map(),
  strokePaths = new Map(),
  edgePaths = new Map(),
  strokePathEntries = [],
  viewportTargets = [],
  applyCullingDiff = () => undefined,
}: {
  nodes?: Map<string, HTMLElement>
  nodeSurfaces?: Map<string, HTMLElement>
  strokePaths?: Map<string, NonNullable<ReturnType<CanvasDomRegistry['getStrokeNodePaths']>>>
  edgePaths?: Map<string, NonNullable<ReturnType<CanvasDomRegistry['getEdgePaths']>>>
  strokePathEntries?: Iterable<
    readonly [string, NonNullable<ReturnType<CanvasDomRegistry['getStrokeNodePaths']>>]
  >
  viewportTargets?: Array<HTMLElement>
  applyCullingDiff?: CanvasDomRegistry['applyCullingDiff']
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
    getNodeSurface: (nodeId) => nodeSurfaces.get(nodeId),
    getStrokeNodePaths: (nodeId) => strokePaths.get(nodeId),
    getStrokeNodePathEntries: () => strokePathEntries,
    getEdge: () => undefined,
    getEdgePaths: (edgeId) => edgePaths.get(edgeId),
    getViewportTargets: () => viewportTargets,
    getViewportSurfaceBounds: () => null,
    applyCullingDiff,
    clear: () => undefined,
  }
}
