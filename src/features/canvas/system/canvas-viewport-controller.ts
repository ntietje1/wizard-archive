import { getCanvasNodeBounds } from '../nodes/shared/canvas-node-bounds'
import type { CanvasEngine, CanvasViewport } from './canvas-engine'
import type { Node, XYPosition } from '@xyflow/react'
import type { Bounds } from '../utils/canvas-geometry-utils'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
const ZOOM_BUTTON_FACTOR = 1.2
const WHEEL_ZOOM_SENSITIVITY = 0.002
const MIN_WHEEL_ZOOM_FACTOR = 0.5
const MAX_WHEEL_ZOOM_FACTOR = 2
const WHEEL_PAN_SENSITIVITY = 1
const VIEWPORT_COMMIT_DELAY_MS = 300
const FIT_VIEW_PADDING = 0.15

export interface CanvasViewportController {
  getViewport: () => CanvasViewport
  getZoom: () => number
  screenToCanvasPosition: (position: XYPosition) => XYPosition
  canvasToScreenPosition: (position: XYPosition) => XYPosition
  handleWheel: (event: WheelEvent) => void
  handlePanPointerDown: (event: PointerEvent) => void
  panBy: (delta: XYPosition, options?: CanvasViewportUpdateOptions) => void
  zoomBy: (factor: number, center?: XYPosition, options?: CanvasViewportUpdateOptions) => void
  zoomTo: (zoom: number, center?: XYPosition, options?: CanvasViewportUpdateOptions) => void
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
  startClient: XYPosition
  startViewport: CanvasViewport
}

export function createCanvasViewportController({
  canvasEngine,
  getSurfaceElement,
  mirrorAdapterViewport,
}: {
  canvasEngine: CanvasEngine
  getSurfaceElement: () => HTMLElement | null
  mirrorAdapterViewport?: (viewport: CanvasViewport) => void
}): CanvasViewportController {
  let commitTimer: ReturnType<typeof setTimeout> | null = null
  let panSession: CanvasPanSession | null = null

  const getSurfaceBounds = () => getSurfaceElement()?.getBoundingClientRect() ?? null

  const getViewport = () => canvasEngine.getSnapshot().viewport

  const getSurfaceCenter = (): XYPosition => {
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
    }, VIEWPORT_COMMIT_DELAY_MS)
  }

  const applyViewport = (viewport: CanvasViewport, options: CanvasViewportUpdateOptions = {}) => {
    const nextViewport = normalizeViewport(viewport)
    if (options.commit) {
      if (commitTimer) {
        clearTimeout(commitTimer)
        commitTimer = null
      }
      canvasEngine.setViewport(nextViewport)
      canvasEngine.flushRenderScheduler()
      mirrorAdapterViewport?.(nextViewport)
      return
    }

    canvasEngine.setViewportLive(nextViewport)
    mirrorAdapterViewport?.(nextViewport)
    if (options.deferCommit !== false) {
      scheduleCommit()
    }
  }

  const commit = () => {
    const viewport = getViewport()
    canvasEngine.setViewport(viewport)
    canvasEngine.flushRenderScheduler()
    mirrorAdapterViewport?.(viewport)
  }

  const stopPanSession = (event: PointerEvent, shouldCommit: boolean) => {
    if (!panSession || event.pointerId !== panSession.pointerId) {
      return
    }

    if (shouldCommit) {
      commit()
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
    const nextZoom = clampZoom(zoom)
    const currentZoom = viewport.zoom || MIN_ZOOM
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
        zoomTo(getViewport().zoom * getWheelZoomFactor(deltaY), {
          x: event.clientX,
          y: event.clientY,
        })
        return
      }

      if (shiftKey) {
        applyViewport({
          ...getViewport(),
          x: getViewport().x - deltaY * WHEEL_PAN_SENSITIVITY,
        })
        return
      }

      applyViewport({
        ...getViewport(),
        x: getViewport().x - deltaX * WHEEL_PAN_SENSITIVITY,
        y: getViewport().y - deltaY * WHEEL_PAN_SENSITIVITY,
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
      const viewport = getFitViewViewport(canvasEngine.getSnapshot().nodes, getSurfaceBounds())
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
  if (target instanceof HTMLElement && target.hasPointerCapture(pointerId)) {
    target.releasePointerCapture(pointerId)
  }
}

function getFitViewViewport(
  nodes: ReadonlyArray<Node>,
  surfaceBounds: DOMRect | null,
): CanvasViewport | null {
  if (!surfaceBounds || nodes.length === 0) {
    return null
  }

  const nodesBounds = getCanvasNodesBounds(nodes)
  if (!nodesBounds) {
    return null
  }

  const paddedWidth = nodesBounds.width * (1 + FIT_VIEW_PADDING * 2)
  const paddedHeight = nodesBounds.height * (1 + FIT_VIEW_PADDING * 2)
  if (paddedWidth <= 0 || paddedHeight <= 0) {
    return null
  }

  const zoom = clampZoom(
    Math.min(surfaceBounds.width / paddedWidth, surfaceBounds.height / paddedHeight),
  )
  const x = surfaceBounds.width / 2 - (nodesBounds.x + nodesBounds.width / 2) * zoom
  const y = surfaceBounds.height / 2 - (nodesBounds.y + nodesBounds.height / 2) * zoom

  return { x, y, zoom }
}

function normalizeViewport(viewport: CanvasViewport): CanvasViewport {
  return {
    x: Number.isFinite(viewport.x) ? viewport.x : 0,
    y: Number.isFinite(viewport.y) ? viewport.y : 0,
    zoom: clampZoom(viewport.zoom),
  }
}

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(zoom) ? zoom : 1))
}

function getCanvasNodesBounds(nodes: ReadonlyArray<Node>): Bounds | null {
  let bounds: Bounds | null = null

  for (const node of nodes) {
    const nodeBounds = getCanvasNodeBounds(node)
    if (!nodeBounds) {
      continue
    }

    if (!bounds) {
      bounds = nodeBounds
      continue
    }

    const minX = Math.min(bounds.x, nodeBounds.x)
    const minY = Math.min(bounds.y, nodeBounds.y)
    const maxX = Math.max(bounds.x + bounds.width, nodeBounds.x + nodeBounds.width)
    const maxY = Math.max(bounds.y + bounds.height, nodeBounds.y + nodeBounds.height)
    bounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  return bounds
}
