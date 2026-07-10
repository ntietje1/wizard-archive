import type { CanvasEngine } from './canvas-engine-types'
import type { CanvasDomRuntime } from './canvas-dom-runtime'
import { getCanvasFitViewport } from '../utils/canvas-fit-view'
import type { CanvasPosition, CanvasViewport } from '../types/canvas-domain-types'
import type { CanvasDocumentNode } from '../document-contract'
const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
const ZOOM_BUTTON_FACTOR = 1.2
const WHEEL_ZOOM_SENSITIVITY = 0.002
const MIN_WHEEL_ZOOM_FACTOR = 0.5
const MAX_WHEEL_ZOOM_FACTOR = 2
const WHEEL_PAN_SENSITIVITY = 1
const VIEWPORT_COMMIT_IDLE_MS = 300
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
  setZoomBounds: (bounds: { maxZoom?: number; minZoom?: number }) => void
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
  let zoomBounds = normalizeZoomBounds({ maxZoom, minZoom })
  let hasLiveViewportChange = false

  const getSurfaceBounds = () => getSurfaceElement()?.getBoundingClientRect() ?? null

  const getViewport = () => canvasEngine.getSnapshot().viewport
  const clearScheduledCommit = () => {
    if (!commitTimer) {
      return
    }

    clearTimeout(commitTimer)
    commitTimer = null
  }
  const clampViewportZoom = (zoom: number) =>
    Math.min(zoomBounds.maxZoom, Math.max(zoomBounds.minZoom, Number.isFinite(zoom) ? zoom : 1))
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
      clearScheduledCommit()
      canvasEngine.setViewport(nextViewport)
      domRuntime.flush()
      hasLiveViewportChange = false
      return
    }

    canvasEngine.setViewportLive(nextViewport)
    hasLiveViewportChange = true
    if (options.deferCommit !== false) {
      scheduleCommit()
    }
  }

  const commit = () => {
    clearScheduledCommit()
    const viewport = getViewport()
    canvasEngine.setViewport(viewport)
    domRuntime.flush()
    hasLiveViewportChange = false
  }

  const stopPanSession = (event: PointerEvent, shouldCommit: boolean) => {
    const session = panSession
    if (!session || event.pointerId !== session.pointerId) {
      return
    }

    panSession = null
    if (shouldCommit) {
      commit()
    } else if (event.type === 'pointercancel') {
      applyViewport(session.startViewport, { commit: true })
    }

    releasePointerCapture(session.target, session.pointerId)
    detachPanListeners(session.target)
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

  const handlePanLostPointerCapture: EventListener = (event) => {
    if ('pointerId' in event) {
      stopPanSession(event as PointerEvent, true)
    }
  }

  function attachPanListeners(target: Element) {
    window.addEventListener('pointermove', handlePanPointerMove)
    window.addEventListener('pointerup', handlePanPointerUp)
    window.addEventListener('pointercancel', handlePanPointerCancel)
    target.addEventListener('lostpointercapture', handlePanLostPointerCapture)
  }

  function detachPanListeners(target: Element | null = null) {
    window.removeEventListener('pointermove', handlePanPointerMove)
    window.removeEventListener('pointerup', handlePanPointerUp)
    window.removeEventListener('pointercancel', handlePanPointerCancel)
    target?.removeEventListener('lostpointercapture', handlePanLostPointerCapture)
  }

  const zoomTo = (
    zoom: number,
    center = getSurfaceCenter(),
    options: CanvasViewportUpdateOptions = {},
  ) => {
    const viewport = getViewport()
    const nextZoom = clampViewportZoom(zoom)
    const currentZoom = viewport.zoom || zoomBounds.minZoom
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
      if (event.target instanceof Element && event.target.closest('.nowheel')) {
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
      attachPanListeners(target)
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
        maxZoom: zoomBounds.maxZoom,
        minZoom: zoomBounds.minZoom,
      })
      if (viewport) {
        applyViewport(viewport, { commit: true })
      }
    },
    syncFromDocumentOrAdapter: (viewport) => {
      applyViewport(viewport, { commit: true })
    },
    setZoomBounds: (bounds) => {
      zoomBounds = normalizeZoomBounds(bounds, zoomBounds)
      const viewport = getViewport()
      const clampedZoom = clampViewportZoom(viewport.zoom)
      if (clampedZoom !== viewport.zoom) {
        zoomTo(clampedZoom, getSurfaceCenter(), { commit: true })
      }
    },
    commit,
    destroy: () => {
      if (hasLiveViewportChange) {
        commit()
      } else {
        clearScheduledCommit()
      }
      if (panSession) {
        const session = panSession
        panSession = null
        releasePointerCapture(session.target, session.pointerId)
        detachPanListeners(session.target)
      } else {
        detachPanListeners()
      }
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

function normalizeZoomBounds(
  bounds: { maxZoom?: number; minZoom?: number },
  fallback: { maxZoom: number; minZoom: number } = { maxZoom: MAX_ZOOM, minZoom: MIN_ZOOM },
) {
  const maxZoom = isValidZoomBound(bounds.maxZoom) ? bounds.maxZoom : fallback.maxZoom
  const minZoom = isValidZoomBound(bounds.minZoom) ? bounds.minZoom : fallback.minZoom
  return {
    maxZoom: Math.max(maxZoom, minZoom),
    minZoom: Math.min(maxZoom, minZoom),
  }
}

function isValidZoomBound(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function getFitViewViewport(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  surfaceBounds: DOMRect | null,
  zoomBounds: { maxZoom: number; minZoom: number },
): CanvasViewport | null {
  if (
    !surfaceBounds ||
    nodes.length === 0 ||
    !Number.isFinite(surfaceBounds.width) ||
    !Number.isFinite(surfaceBounds.height) ||
    surfaceBounds.width <= 0 ||
    surfaceBounds.height <= 0
  ) {
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
