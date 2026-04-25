import { normalizeCanvasEdgeStyle } from '../edges/shared/canvas-edge-style'
import { getCanvasNodeSurfaceStyle } from '../nodes/shared/canvas-node-surface-style'
import { getCachedStrokeDetailPath } from '../nodes/stroke/stroke-path-cache'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'
import type { CanvasDomRegistry } from './canvas-dom-registry'
import type { StrokeNodeData } from '../nodes/stroke/stroke-node-model'
import type { Edge, XYPosition } from '@xyflow/react'

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

export type CanvasCameraState = 'idle' | 'moving'

export interface CanvasRenderScheduler {
  scheduleNodeTransforms: (positions: ReadonlyMap<string, XYPosition>) => void
  scheduleEdgePaths: (paths: ReadonlyMap<string, string>) => void
  scheduleNodeDataPatches: (updates: ReadonlyMap<string, Record<string, unknown>>) => void
  scheduleEdgePatches: (updates: ReadonlyMap<string, CanvasEdgePatch>) => void
  scheduleViewportTransform: (viewport: CanvasViewport) => void
  scheduleCameraState: (state: CanvasCameraState) => void
  flush: () => void
  destroy: () => void
}

export function createCanvasRenderScheduler({
  domRegistry,
}: {
  domRegistry: CanvasDomRegistry
}): CanvasRenderScheduler {
  const pendingNodeTransforms = new Map<string, XYPosition>()
  const pendingEdgePaths = new Map<string, string>()
  const pendingNodeDataPatches = new Map<string, Record<string, unknown>>()
  const pendingEdgePatches = new Map<string, CanvasEdgePatch>()
  let pendingViewportTransform: CanvasViewport | null = null
  let pendingCameraState: CanvasCameraState | null = null
  let appliedCameraState: CanvasCameraState | null = null
  let frameId: number | null = null

  const applyCameraState = (state: CanvasCameraState) => {
    if (appliedCameraState === state) {
      return
    }

    for (const viewport of domRegistry.getViewportTargets()) {
      viewport.dataset.cameraState = state
      viewport.style.willChange = state === 'moving' ? 'transform' : ''
    }
    appliedCameraState = state
  }

  const requestFlush = () => {
    if (frameId !== null || typeof requestAnimationFrame === 'undefined') {
      return
    }

    frameId = requestAnimationFrame(() => {
      frameId = null
      flush()
    })
  }

  const flush = () => {
    for (const [nodeId, position] of pendingNodeTransforms) {
      const element = domRegistry.getNode(nodeId)
      if (element) {
        element.style.transform = `translate(${position.x}px, ${position.y}px)`
      }
    }
    pendingNodeTransforms.clear()

    for (const [edgeId, path] of pendingEdgePaths) {
      const paths = domRegistry.getEdgePaths(edgeId)
      paths?.path?.setAttribute('d', path)
      paths?.highlightPath?.setAttribute('d', path)
      paths?.interactionPath?.setAttribute('d', path)
    }
    pendingEdgePaths.clear()

    for (const [nodeId, patch] of pendingNodeDataPatches) {
      const surface = domRegistry.getNodeSurface(nodeId)
      if (surface) {
        Object.assign(surface.style, getCanvasNodeSurfaceStyle(patch))
      }

      const strokePaths = domRegistry.getStrokeNodePaths(nodeId)
      const strokeData = parseStrokeNodeData(patch)
      if (strokeData) {
        const opacity = String((strokeData.opacity ?? 100) / 100)
        const detailPath = getCachedStrokeDetailPath(nodeId, strokeData)
        if (detailPath && strokePaths?.path) {
          strokePaths.path.setAttribute('d', detailPath)
          strokePaths.path.setAttribute('fill', strokeData.color ?? 'transparent')
          strokePaths.path.setAttribute('opacity', opacity)
        }

        const highlightPath = getCachedStrokeDetailPath(nodeId, strokeData, strokeData.size * 0.3)
        if (highlightPath && strokePaths?.highlightPath) {
          strokePaths.highlightPath.setAttribute('d', highlightPath)
        }
      }
    }
    pendingNodeDataPatches.clear()

    for (const [edgeId, patch] of pendingEdgePatches) {
      if (!patch.style) {
        continue
      }

      const paths = domRegistry.getEdgePaths(edgeId)
      if (!paths?.path) {
        continue
      }

      const style = normalizeCanvasEdgeStyle({
        ...readEdgeStyle(paths.path),
        ...patch.style,
      })
      paths.path.style.stroke = style.stroke
      paths.path.style.strokeWidth = String(style.strokeWidth)
      paths.path.style.opacity = String(style.opacity)
      if (paths.highlightPath) {
        paths.highlightPath.style.strokeWidth = String(Math.max(style.strokeWidth * 0.15, 1))
      }
    }
    pendingEdgePatches.clear()

    if (pendingCameraState !== null) {
      applyCameraState(pendingCameraState)
      pendingCameraState = null
    }

    if (pendingViewportTransform) {
      for (const viewport of domRegistry.getViewportTargets()) {
        viewport.style.transform = `translate3d(${pendingViewportTransform.x}px, ${pendingViewportTransform.y}px, 0) scale(${pendingViewportTransform.zoom})`
      }
      pendingViewportTransform = null
    }
  }

  return {
    scheduleNodeTransforms: (positions) => {
      for (const [nodeId, position] of positions) {
        pendingNodeTransforms.set(nodeId, position)
      }
      requestFlush()
    },
    scheduleEdgePaths: (paths) => {
      for (const [edgeId, path] of paths) {
        pendingEdgePaths.set(edgeId, path)
      }
      requestFlush()
    },
    scheduleNodeDataPatches: (updates) => {
      for (const [nodeId, patch] of updates) {
        pendingNodeDataPatches.set(nodeId, {
          ...pendingNodeDataPatches.get(nodeId),
          ...patch,
        })
      }
      requestFlush()
    },
    scheduleEdgePatches: (updates) => {
      for (const [edgeId, patch] of updates) {
        const existing = pendingEdgePatches.get(edgeId)
        pendingEdgePatches.set(edgeId, {
          ...existing,
          ...patch,
          style: patch.style ? { ...existing?.style, ...patch.style } : existing?.style,
        })
      }
      requestFlush()
    },
    scheduleViewportTransform: (viewport) => {
      pendingViewportTransform = viewport
      requestFlush()
    },
    scheduleCameraState: (state) => {
      if (state === 'moving') {
        applyCameraState('moving')
        pendingCameraState = null
        return
      }

      pendingCameraState = 'idle'
      requestFlush()
    },
    flush,
    destroy: () => {
      if (frameId !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(frameId)
      }
      frameId = null
      pendingNodeTransforms.clear()
      pendingEdgePaths.clear()
      pendingNodeDataPatches.clear()
      pendingEdgePatches.clear()
      pendingViewportTransform = null
      pendingCameraState = null
      appliedCameraState = null
    },
  }
}

function parseStrokeNodeData(data: Record<string, unknown>): StrokeNodeData | null {
  if (!Array.isArray(data.points) || typeof data.size !== 'number') {
    return null
  }

  return data as StrokeNodeData
}

function readEdgeStyle(path: SVGPathElement): NonNullable<Edge['style']> {
  const strokeWidth = path.style.strokeWidth
  const opacity = path.style.opacity
  return {
    stroke: path.style.stroke,
    strokeWidth: strokeWidth ? Number.parseFloat(strokeWidth) : undefined,
    opacity: opacity ? Number.parseFloat(opacity) : undefined,
  }
}
