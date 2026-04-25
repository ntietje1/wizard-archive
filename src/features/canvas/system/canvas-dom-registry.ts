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
  registerEdgePaths: (edgeId: string, paths: CanvasRegisteredEdgePaths) => () => void
  registerViewport: (element: HTMLElement | null) => () => void
  getNode: (nodeId: string) => HTMLElement | undefined
  getNodeSurface: (nodeId: string) => HTMLElement | undefined
  getStrokeNodePaths: (nodeId: string) => CanvasRegisteredStrokeNodePaths | undefined
  getEdgePaths: (edgeId: string) => CanvasRegisteredEdgePaths | undefined
  getViewport: () => HTMLElement | undefined
  clear: () => void
}

export function createCanvasDomRegistry(): CanvasDomRegistry {
  const nodes = new Map<string, HTMLElement>()
  const nodeSurfaces = new Map<string, HTMLElement>()
  const strokeNodePaths = new Map<string, CanvasRegisteredStrokeNodePaths>()
  const edgePaths = new Map<string, CanvasRegisteredEdgePaths>()
  let viewport: HTMLElement | undefined

  return {
    registerNode: (nodeId, element) => {
      if (element) {
        nodes.set(nodeId, element)
      }

      return () => {
        if (!element || nodes.get(nodeId) === element) {
          nodes.delete(nodeId)
        }
      }
    },
    registerNodeSurface: (nodeId, element) => {
      if (element) {
        nodeSurfaces.set(nodeId, element)
      }

      return () => {
        if (!element || nodeSurfaces.get(nodeId) === element) {
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
    registerEdgePaths: (edgeId, paths) => {
      edgePaths.set(edgeId, paths)

      return () => {
        if (edgePaths.get(edgeId) === paths) {
          edgePaths.delete(edgeId)
        }
      }
    },
    registerViewport: (element) => {
      viewport = element ?? undefined

      return () => {
        if (!element || viewport === element) {
          viewport = undefined
        }
      }
    },
    getNode: (nodeId) => nodes.get(nodeId),
    getNodeSurface: (nodeId) => nodeSurfaces.get(nodeId),
    getStrokeNodePaths: (nodeId) => strokeNodePaths.get(nodeId),
    getEdgePaths: (edgeId) => edgePaths.get(edgeId),
    getViewport: () => viewport,
    clear: () => {
      nodes.clear()
      nodeSurfaces.clear()
      strokeNodePaths.clear()
      edgePaths.clear()
      viewport = undefined
    },
  }
}
