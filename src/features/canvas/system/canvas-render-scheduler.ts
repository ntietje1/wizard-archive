import { normalizeCanvasEdgeStyle } from '../edges/shared/canvas-edge-style'
import { getCanvasNodeSurfaceStyle } from '../nodes/shared/canvas-node-surface-style'
import { getCachedStrokeDetailPath } from '../nodes/stroke/stroke-path-cache'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'
import type { CanvasCullingDiff } from './canvas-culling'
import type { CanvasDomRegistry } from './canvas-dom-registry'
import type { StrokeNodeData } from '../nodes/stroke/stroke-node-model'
import type { CanvasEdge, CanvasPosition } from '../types/canvas-domain-types'

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

export type CanvasCameraState = 'idle' | 'moving'

interface CanvasRenderScheduler {
  scheduleNodeTransforms: (positions: ReadonlyMap<string, CanvasPosition>) => void
  scheduleEdgePaths: (paths: ReadonlyMap<string, string>) => void
  scheduleNodeDataPatches: (updates: ReadonlyMap<string, Record<string, unknown>>) => void
  scheduleEdgePatches: (updates: ReadonlyMap<string, CanvasEdgePatch>) => void
  scheduleViewportTransform: (viewport: CanvasViewport) => void
  scheduleCameraState: (state: CanvasCameraState) => void
  scheduleCullingDiff: (diff: CanvasCullingDiff) => void
  flush: () => void
  destroy: () => void
}

export function createCanvasRenderScheduler({
  domRegistry,
}: {
  domRegistry: CanvasDomRegistry
}): CanvasRenderScheduler {
  const pendingNodeTransforms = new Map<string, CanvasPosition>()
  const pendingEdgePaths = new Map<string, string>()
  const pendingNodeDataPatches = new Map<string, Record<string, unknown>>()
  const pendingEdgePatches = new Map<string, CanvasEdgePatch>()
  const pendingCulledNodeIds = new Map<string, boolean>()
  const pendingCulledEdgeIds = new Map<string, boolean>()
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
    applyNodeTransforms()
    applyEdgePaths()
    applyNodeDataPatches()
    applyEdgePatches()
    applyPendingCameraState()
    applyViewportTransform()
    applyCullingDiff()
  }

  const applyNodeTransforms = () => {
    for (const [nodeId, position] of pendingNodeTransforms) {
      const element = domRegistry.getNode(nodeId)
      if (element) {
        element.style.transform = `translate(${position.x}px, ${position.y}px)`
      }
    }
    pendingNodeTransforms.clear()
  }

  const applyEdgePaths = () => {
    for (const [edgeId, path] of pendingEdgePaths) {
      const paths = domRegistry.getEdgePaths(edgeId)
      paths?.path?.setAttribute('d', path)
      paths?.highlightPath?.setAttribute('d', path)
      paths?.interactionPath?.setAttribute('d', path)
    }
    pendingEdgePaths.clear()
  }

  const applyNodeDataPatches = () => {
    for (const [nodeId, patch] of pendingNodeDataPatches) {
      const surface = domRegistry.getNodeSurface(nodeId)
      if (surface) {
        Object.assign(surface.style, getCanvasNodeSurfaceStyle(patch))
      }

      applyStrokeNodeDataPatch(nodeId, patch)
    }
    pendingNodeDataPatches.clear()
  }

  const applyStrokeNodeDataPatch = (nodeId: string, patch: Record<string, unknown>) => {
    const strokeData = parseStrokeNodeData(patch)
    if (!strokeData) {
      return
    }

    const strokePaths = domRegistry.getStrokeNodePaths(nodeId)
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

  const applyEdgePatches = () => {
    for (const [edgeId, patch] of pendingEdgePatches) {
      if (patch.style) {
        applyEdgeStylePatch(edgeId, patch.style)
      }
    }
    pendingEdgePatches.clear()
  }

  const applyEdgeStylePatch = (edgeId: string, patch: CanvasEdgePatch['style']) => {
    const paths = domRegistry.getEdgePaths(edgeId)
    if (!paths?.path) {
      return
    }

    const style = normalizeCanvasEdgeStyle({
      ...readEdgeStyle(paths.path),
      ...patch,
    })
    paths.path.style.stroke = style.stroke
    paths.path.style.strokeWidth = String(style.strokeWidth)
    paths.path.style.opacity = String(style.opacity)
    if (paths.highlightPath) {
      paths.highlightPath.style.strokeWidth = String(Math.max(style.strokeWidth * 0.15, 1))
    }
  }

  const applyPendingCameraState = () => {
    if (pendingCameraState === null) {
      return
    }

    applyCameraState(pendingCameraState)
    pendingCameraState = null
  }

  const applyViewportTransform = () => {
    if (!pendingViewportTransform) {
      return
    }

    for (const viewport of domRegistry.getViewportTargets()) {
      viewport.style.transform = `translate3d(${pendingViewportTransform.x}px, ${pendingViewportTransform.y}px, 0) scale(${pendingViewportTransform.zoom})`
    }
    pendingViewportTransform = null
  }

  const applyCullingDiff = () => {
    if (pendingCulledNodeIds.size === 0 && pendingCulledEdgeIds.size === 0) {
      return
    }

    domRegistry.applyCullingDiff({
      nodeIds: pendingCulledNodeIds,
      edgeIds: pendingCulledEdgeIds,
    })
    pendingCulledNodeIds.clear()
    pendingCulledEdgeIds.clear()
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
    scheduleCullingDiff: (diff) => {
      for (const [nodeId, isCulled] of diff.nodeIds) {
        pendingCulledNodeIds.set(nodeId, isCulled)
      }
      for (const [edgeId, isCulled] of diff.edgeIds) {
        pendingCulledEdgeIds.set(edgeId, isCulled)
      }
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
      pendingCulledNodeIds.clear()
      pendingCulledEdgeIds.clear()
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

function readEdgeStyle(path: SVGPathElement): NonNullable<CanvasEdge['style']> {
  const strokeWidth = path.style.strokeWidth
  const opacity = path.style.opacity
  return {
    stroke: path.style.stroke,
    strokeWidth: strokeWidth ? Number.parseFloat(strokeWidth) : undefined,
    opacity: opacity ? Number.parseFloat(opacity) : undefined,
  }
}
