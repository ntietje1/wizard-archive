import type { CanvasEngine, CanvasViewport } from './canvas-engine'
import type { CanvasDomRuntime } from './canvas-dom-runtime'
import { getCanvasFitViewport } from '../utils/canvas-fit-view'
import type { CanvasDocumentNode, CanvasPosition } from '../types/canvas-domain-types'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
const ZOOM_BUTTON_FACTOR = 1.2
const WHEEL_ZOOM_SENSITIVITY = 0.002
const MIN_WHEEL_ZOOM_FACTOR = 0.5
const MAX_WHEEL_ZOOM_FACTOR = 2
const WHEEL_PAN_SENSITIVITY = 1
export const VIEWPORT_COMMIT_IDLE_MS = 300
const FIT_VIEW_PADDING = 0.15

export interface CanvasViewportController {
  getViewport: () => CanvasViewport
  getZoom: () => number
  screenToCanvasPosition: (position: CanvasPosition) => CanvasPosition
  canvasToScreenPosition: (position: CanvasPosition) => CanvasPosition
  handleWheel: (event: WheelEvent) => void
  handlePanPointerDown: (event: PointerEvent) => void
  panBy: (delta: CanvasPosition, options?: CanvasViewportUpdateOptions) => void
  zoomBy: (factor: number, center?: CanvasPosition, options?: CanvasViewportUpdateOptions) => void
  zoomTo: (zoom: number, center?: CanvasPosition, options?: CanvasViewportUpdateOptions) => void
  zoomIn: () => void
  zoomOut: () => void
  fitView: () => void
  syncFromDocumentOrAdapter: (viewport: CanvasViewport) => void
  commit: () => void
  destroy: () => void
}

interface CanvasViewportUpdateOptions {
  commit?: boolean
  deferCommit?: boolean
}

interface CanvasPanSession {
  pointerId: number
  target: Element | null
  startClient: CanvasPosition
  startViewport: CanvasViewport
}

export function createCanvasViewportController({
  canvasEngine,
  domRuntime,
  getSurfaceElement,
  maxZoom = MAX_ZOOM,
  minZoom = MIN_ZOOM,
}: {
  canvasEngine: CanvasEngine
  domRuntime: Pick<CanvasDomRuntime, 'flush'>
  getSurfaceElement: () => HTMLElement | null
  maxZoom?: number
  minZoom?: number
}): CanvasViewportController {
  let commitTimer: ReturnType<typeof setTimeout> | null = null
  let panSession: CanvasPanSession | null = null

  const getSurfaceBounds = () => getSurfaceElement()?.getBoundingClientRect() ?? null

  const getViewport = () => canvasEngine.getSnapshot().viewport
  const clampViewportZoom = (zoom: number) =>
    Math.min(maxZoom, Math.max(minZoom, Number.isFinite(zoom) ? zoom : 1))
  const normalizeViewport = (viewport: CanvasViewport): CanvasViewport => ({
    x: Number.isFinite(viewport.x) ? viewport.x : 0,
    y: Number.isFinite(viewport.y) ? viewport.y : 0,
    zoom: clampViewportZoom(viewport.zoom),
  })

  const getSurfaceCenter = (): CanvasPosition => {
    const bounds = getSurfaceBounds()
    return bounds
      ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      : { x: 0, y: 0 }
  }

  const scheduleCommit = () => {
    if (commitTimer) {
      clearTimeout(commitTimer)
    }

    commitTimer = setTimeout(() => {
      commitTimer = null
      commit()
    }, VIEWPORT_COMMIT_IDLE_MS)
  }

  const applyViewport = (viewport: CanvasViewport, options: CanvasViewportUpdateOptions = {}) => {
    const nextViewport = normalizeViewport(viewport)
    if (options.commit) {
      if (commitTimer) {
        clearTimeout(commitTimer)
        commitTimer = null
      }
      canvasEngine.setViewport(nextViewport)
      domRuntime.flush()
      return
    }

    canvasEngine.setViewportLive(nextViewport)
    if (options.deferCommit !== false) {
      scheduleCommit()
    }
  }

  const commit = () => {
    const viewport = getViewport()
    canvasEngine.setViewport(viewport)
    domRuntime.flush()
  }

  const stopPanSession = (event: PointerEvent, shouldCommit: boolean) => {
    if (!panSession || event.pointerId !== panSession.pointerId) {
      return
    }

    if (shouldCommit) {
      commit()
    } else if (event.type === 'pointercancel') {
      applyViewport(panSession.startViewport, { commit: true })
    }

    releasePointerCapture(panSession.target, panSession.pointerId)
    panSession = null
    detachPanListeners()
  }

  const handlePanPointerMove = (event: PointerEvent) => {
    if (!panSession || event.pointerId !== panSession.pointerId) {
      return
    }

    event.preventDefault()
    applyViewport(
      {
        ...panSession.startViewport,
        x: panSession.startViewport.x + event.clientX - panSession.startClient.x,
        y: panSession.startViewport.y + event.clientY - panSession.startClient.y,
      },
      { deferCommit: false },
    )
  }

  const handlePanPointerUp = (event: PointerEvent) => {
    stopPanSession(event, true)
  }

  const handlePanPointerCancel = (event: PointerEvent) => {
    stopPanSession(event, false)
  }

  function attachPanListeners() {
    window.addEventListener('pointermove', handlePanPointerMove)
    window.addEventListener('pointerup', handlePanPointerUp)
    window.addEventListener('pointercancel', handlePanPointerCancel)
  }

  function detachPanListeners() {
    window.removeEventListener('pointermove', handlePanPointerMove)
    window.removeEventListener('pointerup', handlePanPointerUp)
    window.removeEventListener('pointercancel', handlePanPointerCancel)
  }

  const zoomTo = (
    zoom: number,
    center = getSurfaceCenter(),
    options: CanvasViewportUpdateOptions = {},
  ) => {
    const viewport = getViewport()
    const nextZoom = clampViewportZoom(zoom)
    const currentZoom = viewport.zoom || minZoom
    const scale = nextZoom / currentZoom
    const bounds = getSurfaceBounds()
    const centerX = bounds ? center.x - bounds.left : center.x
    const centerY = bounds ? center.y - bounds.top : center.y

    applyViewport(
      {
        x: centerX - (centerX - viewport.x) * scale,
        y: centerY - (centerY - viewport.y) * scale,
        zoom: nextZoom,
      },
      options,
    )
  }

  return {
    getViewport,
    getZoom: () => getViewport().zoom,
    screenToCanvasPosition: (position) =>
      canvasEngine.screenToCanvasPosition(position, getSurfaceBounds()),
    canvasToScreenPosition: (position) =>
      canvasEngine.canvasToScreenPosition(position, getSurfaceBounds()),
    handleWheel: (event) => {
      if (!event.ctrlKey && event.target instanceof Element && event.target.closest('.nowheel')) {
        return
      }

      event.preventDefault()
      const { deltaX, deltaY, ctrlKey, shiftKey } = event
      if (ctrlKey) {
        const viewport = getViewport()
        zoomTo(viewport.zoom * getWheelZoomFactor(deltaY), {
          x: event.clientX,
          y: event.clientY,
        })
        return
      }

      const viewport = getViewport()
      if (shiftKey) {
        applyViewport({
          ...viewport,
          x: viewport.x - deltaY * WHEEL_PAN_SENSITIVITY,
        })
        return
      }

      applyViewport({
        ...viewport,
        x: viewport.x - deltaX * WHEEL_PAN_SENSITIVITY,
        y: viewport.y - deltaY * WHEEL_PAN_SENSITIVITY,
      })
    },
    handlePanPointerDown: (event) => {
      if (panSession || (event.target instanceof Element && event.target.closest('.nopan'))) {
        return
      }

      const target = event.currentTarget
      if (!(target instanceof Element)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      target.setPointerCapture(event.pointerId)
      panSession = {
        pointerId: event.pointerId,
        target,
        startClient: { x: event.clientX, y: event.clientY },
        startViewport: getViewport(),
      }
      attachPanListeners()
    },
    panBy: (delta, options) => {
      const viewport = getViewport()
      applyViewport(
        {
          ...viewport,
          x: viewport.x + delta.x,
          y: viewport.y + delta.y,
        },
        options,
      )
    },
    zoomBy: (factor, center, options) => {
      zoomTo(getViewport().zoom * factor, center, options)
    },
    zoomTo,
    zoomIn: () => {
      zoomTo(getViewport().zoom * ZOOM_BUTTON_FACTOR, getSurfaceCenter())
    },
    zoomOut: () => {
      zoomTo(getViewport().zoom / ZOOM_BUTTON_FACTOR, getSurfaceCenter())
    },
    fitView: () => {
      const viewport = getFitViewViewport(canvasEngine.getSnapshot().nodes, getSurfaceBounds(), {
        maxZoom,
        minZoom,
      })
      if (viewport) {
        applyViewport(viewport, { commit: true })
      }
    },
    syncFromDocumentOrAdapter: (viewport) => {
      applyViewport(viewport, { commit: true })
    },
    commit,
    destroy: () => {
      if (commitTimer) {
        clearTimeout(commitTimer)
        commitTimer = null
      }
      if (panSession) {
        releasePointerCapture(panSession.target, panSession.pointerId)
        panSession = null
      }
      detachPanListeners()
    },
  }
}

function getWheelZoomFactor(deltaY: number) {
  const factor = 2 ** (-deltaY * WHEEL_ZOOM_SENSITIVITY)
  return Math.min(MAX_WHEEL_ZOOM_FACTOR, Math.max(MIN_WHEEL_ZOOM_FACTOR, factor))
}

function releasePointerCapture(target: Element | null, pointerId: number) {
  if (target?.hasPointerCapture(pointerId)) {
    target.releasePointerCapture(pointerId)
  }
}

function getFitViewViewport(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  surfaceBounds: DOMRect | null,
  zoomBounds: { maxZoom: number; minZoom: number },
): CanvasViewport | null {
  if (!surfaceBounds || nodes.length === 0) {
    return null
  }

  return getCanvasFitViewport({
    nodes,
    width: surfaceBounds.width,
    height: surfaceBounds.height,
    minZoom: zoomBounds.minZoom,
    maxZoom: zoomBounds.maxZoom,
    padding: FIT_VIEW_PADDING,
  })
}
