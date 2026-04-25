export interface CanvasRegisteredEdgePaths {
  path: SVGPathElement | null
  highlightPath?: SVGPathElement | null
  interactionPath?: SVGPathElement | null
}

export interface CanvasRegisteredStrokeNodePaths {
  path: SVGPathElement | null
  highlightPath?: SVGPathElement | null
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
  getEdge: (edgeId: string) => SVGElement | undefined
  getEdgePaths: (edgeId: string) => CanvasRegisteredEdgePaths | undefined
  getViewportTargets: () => ReadonlyArray<HTMLElement>
  clear: () => void
}

export function createCanvasDomRegistry(): CanvasDomRegistry {
  const nodes = new Map<string, HTMLElement>()
  const nodeSurfaces = new Map<string, HTMLElement>()
  const strokeNodePaths = new Map<string, CanvasRegisteredStrokeNodePaths>()
  const edges = new Map<string, SVGElement>()
  const edgePaths = new Map<string, CanvasRegisteredEdgePaths>()
  const viewportOverlays = new Set<HTMLElement>()
  let viewport: HTMLElement | undefined

  return {
    registerNode: (nodeId, element) => {
      if (!element) {
        return () => undefined
      }

      nodes.set(nodeId, element)
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
      return () => {
        if (edges.get(edgeId) === element) {
          edges.delete(edgeId)
        }
      }
    },
    registerEdgePaths: (edgeId, paths) => {
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

      viewport = element ?? undefined

      return () => {
        if (viewport === element) {
          viewport = undefined
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
    getEdge: (edgeId) => edges.get(edgeId),
    getEdgePaths: (edgeId) => edgePaths.get(edgeId),
    getViewportTargets: () => (viewport ? [viewport, ...viewportOverlays] : [...viewportOverlays]),
    clear: () => {
      nodes.clear()
      nodeSurfaces.clear()
      strokeNodePaths.clear()
      edges.clear()
      edgePaths.clear()
      viewportOverlays.clear()
      viewport = undefined
    },
  }
}
