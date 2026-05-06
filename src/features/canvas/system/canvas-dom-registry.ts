import type { CanvasCullingDiff } from './canvas-culling'
import type { StrokeNodeData } from '../nodes/stroke/stroke-node-model'
import { readElementBorderBoxSize, readResizeObserverBorderBoxSize } from './canvas-element-size'

export interface CanvasRegisteredEdgePaths {
  path: SVGPathElement | null
  highlightPath?: SVGPathElement | null
  interactionPath?: SVGPathElement | null
}

export interface CanvasRegisteredStrokeNodePaths {
  path: SVGPathElement | null
  highlightPath?: SVGPathElement | null
  data?: StrokeNodeData
}

export interface CanvasDomRegistry {
  registerNode: (nodeId: string, element: HTMLElement | null) => () => void
  registerNodeSurface: (nodeId: string, element: HTMLElement | null) => () => void
  registerStrokeNodePaths: (nodeId: string, paths: CanvasRegisteredStrokeNodePaths) => () => void
  registerEdge: (edgeId: string, element: SVGElement | null) => () => void
  registerEdgePaths: (edgeId: string, paths: CanvasRegisteredEdgePaths) => () => void
  registerViewport: (element: HTMLElement | null) => () => void
  registerViewportOverlay: (element: HTMLElement | null) => () => void
  getNode: (nodeId: string) => HTMLElement | undefined
  getNodeSurface: (nodeId: string) => HTMLElement | undefined
  getStrokeNodePaths: (nodeId: string) => CanvasRegisteredStrokeNodePaths | undefined
  getStrokeNodePathEntries: () => ReadonlyArray<readonly [string, CanvasRegisteredStrokeNodePaths]>
  getEdge: (edgeId: string) => SVGElement | undefined
  getEdgePaths: (edgeId: string) => CanvasRegisteredEdgePaths | undefined
  getViewportTargets: () => ReadonlyArray<HTMLElement>
  getViewportSurfaceBounds: () => Pick<DOMRect, 'width' | 'height'> | null
  applyCullingDiff: (diff: CanvasCullingDiff) => void
  clear: () => void
}

function cloneStrokeNodePaths(
  paths: CanvasRegisteredStrokeNodePaths,
): CanvasRegisteredStrokeNodePaths {
  return {
    ...paths,
    data: paths.data ? cloneStrokeNodeData(paths.data) : paths.data,
  }
}

function cloneStrokeNodeData(data: StrokeNodeData): StrokeNodeData {
  if (typeof structuredClone === 'function') {
    return structuredClone(data)
  }

  return JSON.parse(JSON.stringify(data)) as StrokeNodeData
}

export function createCanvasDomRegistry(): CanvasDomRegistry {
  const nodes = new Map<string, HTMLElement>()
  const nodeSurfaces = new Map<string, HTMLElement>()
  const strokeNodePaths = new Map<string, CanvasRegisteredStrokeNodePaths>()
  const edges = new Map<string, SVGElement>()
  const edgePaths = new Map<string, CanvasRegisteredEdgePaths>()
  const viewportOverlays = new Set<HTMLElement>()
  const culledNodeIds = new Set<string>()
  const culledEdgeIds = new Set<string>()
  let viewport: HTMLElement | undefined
  let viewportSurfaceBounds: Pick<DOMRect, 'width' | 'height'> | null = null
  let viewportSurfaceBoundsObserver: ResizeObserver | null = null

  const disconnectViewportSurfaceBoundsObserver = () => {
    viewportSurfaceBoundsObserver?.disconnect()
    viewportSurfaceBoundsObserver = null
    viewportSurfaceBounds = null
  }

  const observeViewportSurfaceBounds = (element: HTMLElement) => {
    const surfaceElement = element.parentElement
    disconnectViewportSurfaceBoundsObserver()
    if (!surfaceElement) {
      viewportSurfaceBounds = { width: 0, height: 0 }
      return
    }

    viewportSurfaceBounds = readElementBorderBoxSize(surfaceElement)
    if (typeof ResizeObserver === 'undefined') {
      return
    }

    viewportSurfaceBoundsObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return
      }

      viewportSurfaceBounds = readResizeObserverBorderBoxSize(entry)
    })
    viewportSurfaceBoundsObserver.observe(surfaceElement)
  }

  return {
    registerNode: (nodeId, element) => {
      if (!element) {
        return () => undefined
      }

      nodes.set(nodeId, element)
      applyCullingDisplay(element, culledNodeIds.has(nodeId))
      return () => {
        if (nodes.get(nodeId) === element) {
          nodes.delete(nodeId)
        }
      }
    },
    registerNodeSurface: (nodeId, element) => {
      if (!element) {
        return () => undefined
      }

      nodeSurfaces.set(nodeId, element)
      return () => {
        if (nodeSurfaces.get(nodeId) === element) {
          nodeSurfaces.delete(nodeId)
        }
      }
    },
    registerStrokeNodePaths: (nodeId, paths) => {
      if (areStrokeNodePathsEmpty(paths)) {
        return () => undefined
      }

      strokeNodePaths.set(nodeId, paths)

      return () => {
        if (strokeNodePaths.get(nodeId) === paths) {
          strokeNodePaths.delete(nodeId)
        }
      }
    },
    registerEdge: (edgeId, element) => {
      if (!element) {
        return () => undefined
      }

      edges.set(edgeId, element)
      applyCullingDisplay(element, culledEdgeIds.has(edgeId))
      return () => {
        if (edges.get(edgeId) === element) {
          edges.delete(edgeId)
        }
      }
    },
    registerEdgePaths: (edgeId, paths) => {
      if (areEdgePathsEmpty(paths)) {
        return () => undefined
      }

      edgePaths.set(edgeId, paths)

      return () => {
        if (edgePaths.get(edgeId) === paths) {
          edgePaths.delete(edgeId)
        }
      }
    },
    registerViewport: (element) => {
      if (!element) {
        return () => undefined
      }

      viewport = element
      observeViewportSurfaceBounds(element)

      return () => {
        if (viewport === element) {
          viewport = undefined
          disconnectViewportSurfaceBoundsObserver()
        }
      }
    },
    registerViewportOverlay: (element) => {
      if (element) {
        viewportOverlays.add(element)
      }

      return () => {
        if (element) {
          viewportOverlays.delete(element)
        }
      }
    },
    getNode: (nodeId) => nodes.get(nodeId),
    getNodeSurface: (nodeId) => nodeSurfaces.get(nodeId),
    getStrokeNodePaths: (nodeId) => strokeNodePaths.get(nodeId),
    getStrokeNodePathEntries: () =>
      Array.from(strokeNodePaths.entries(), ([nodeId, paths]) => [
        nodeId,
        cloneStrokeNodePaths(paths),
      ]),
    getEdge: (edgeId) => edges.get(edgeId),
    getEdgePaths: (edgeId) => edgePaths.get(edgeId),
    getViewportTargets: () => (viewport ? [viewport, ...viewportOverlays] : [...viewportOverlays]),
    getViewportSurfaceBounds: () => viewportSurfaceBounds,
    applyCullingDiff: (diff) => {
      for (const [nodeId, isCulled] of diff.nodeIds) {
        updateCullingSet(culledNodeIds, nodeId, isCulled)
        const element = nodes.get(nodeId)
        if (element) {
          applyCullingDisplay(element, isCulled)
        }
      }

      for (const [edgeId, isCulled] of diff.edgeIds) {
        updateCullingSet(culledEdgeIds, edgeId, isCulled)
        const element = edges.get(edgeId)
        if (element) {
          applyCullingDisplay(element, isCulled)
        }
      }
    },
    clear: () => {
      for (const nodeId of culledNodeIds) {
        const element = nodes.get(nodeId)
        if (element) {
          applyCullingDisplay(element, false)
        }
      }
      for (const edgeId of culledEdgeIds) {
        const element = edges.get(edgeId)
        if (element) {
          applyCullingDisplay(element, false)
        }
      }
      nodes.clear()
      nodeSurfaces.clear()
      strokeNodePaths.clear()
      edges.clear()
      edgePaths.clear()
      viewportOverlays.clear()
      culledNodeIds.clear()
      culledEdgeIds.clear()
      viewport = undefined
      disconnectViewportSurfaceBoundsObserver()
    },
  }
}

function areStrokeNodePathsEmpty(paths: CanvasRegisteredStrokeNodePaths) {
  return !paths.path && !paths.highlightPath
}

function areEdgePathsEmpty(paths: CanvasRegisteredEdgePaths) {
  return !paths.path && !paths.highlightPath && !paths.interactionPath
}

function updateCullingSet(set: Set<string>, id: string, isCulled: boolean) {
  if (isCulled) {
    set.add(id)
    return
  }

  set.delete(id)
}

function applyCullingDisplay(element: Element, isCulled: boolean) {
  const htmlElement = element as HTMLElement | SVGElement
  htmlElement.style.display = isCulled ? 'none' : ''
  if (isCulled) {
    htmlElement.setAttribute('data-canvas-culled', 'true')
  } else {
    htmlElement.removeAttribute('data-canvas-culled')
  }
}
