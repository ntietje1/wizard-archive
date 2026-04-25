import { normalizeCanvasEdgeStyle } from '../edges/shared/canvas-edge-style'
import { getCanvasNodeSurfaceStyle } from '../nodes/shared/canvas-node-surface-style'
import { pointsToPathD } from '../nodes/stroke/stroke-node-model'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'
import type { CanvasDomRegistry } from './canvas-dom-registry'
import type { Edge, XYPosition } from '@xyflow/react'

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

export interface CanvasRenderScheduler {
  scheduleNodeTransforms: (positions: ReadonlyMap<string, XYPosition>) => void
  scheduleEdgePaths: (paths: ReadonlyMap<string, string>) => void
  scheduleNodeDataPatches: (updates: ReadonlyMap<string, Record<string, unknown>>) => void
  scheduleEdgePatches: (updates: ReadonlyMap<string, CanvasEdgePatch>) => void
  scheduleViewportTransform: (viewport: CanvasViewport) => void
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
  let frameId: number | null = null

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
      const strokePath = getStrokeNodePathFromData(patch)
      if (strokePath) {
        strokePaths?.path?.setAttribute('d', strokePath)
      }

      const strokeHighlightPath = getStrokeNodeHighlightPathFromData(patch)
      if (strokeHighlightPath) {
        strokePaths?.highlightPath?.setAttribute('d', strokeHighlightPath)
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

    if (pendingViewportTransform) {
      const viewport = domRegistry.getViewport()
      if (viewport) {
        viewport.style.transform = `translate(${pendingViewportTransform.x}px, ${pendingViewportTransform.y}px) scale(${pendingViewportTransform.zoom})`
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
    },
  }
}

function getStrokeNodePathFromData(data: Record<string, unknown>): string | null {
  if (!Array.isArray(data.points) || typeof data.size !== 'number') {
    return null
  }

  return pointsToPathD(data.points as Array<[number, number, number]>, data.size)
}

function getStrokeNodeHighlightPathFromData(data: Record<string, unknown>): string | null {
  if (!Array.isArray(data.points) || typeof data.size !== 'number') {
    return null
  }

  return pointsToPathD(data.points as Array<[number, number, number]>, data.size * 0.3)
}

function readEdgeStyle(path: SVGPathElement): NonNullable<Edge['style']> {
  return {
    stroke: path.style.stroke,
    strokeWidth: Number.parseFloat(path.style.strokeWidth),
    opacity: Number.parseFloat(path.style.opacity),
  }
}
