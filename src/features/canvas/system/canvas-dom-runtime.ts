import { createCanvasDomRegistry } from './canvas-dom-registry'
import { createCanvasRenderScheduler } from './canvas-render-scheduler'
import type { CanvasNodeDataPatch } from '../nodes/canvas-node-modules'
import type { CanvasEngineSnapshot } from './canvas-engine-types'

export function createCanvasDomRuntime() {
  const registry = createCanvasDomRegistry()
  const scheduler = createCanvasRenderScheduler({ domRegistry: registry })

  return {
    registry,
    registerNodeElement: registry.registerNode,
    registerNodeSurfaceElement: registry.registerNodeSurface,
    registerStrokeNodePaths: registry.registerStrokeNodePaths,
    registerEdgeElement: registry.registerEdge,
    registerEdgePaths: registry.registerEdgePaths,
    registerViewportElement: registry.registerViewport,
    registerViewportOverlayElement: registry.registerViewportOverlay,
    getViewportSurfaceBounds: registry.getViewportSurfaceBounds,
    scheduleNodeTransforms: scheduler.scheduleNodeTransforms,
    scheduleEdgePaths: scheduler.scheduleEdgePaths,
    scheduleNodeDataPatches: (
      snapshot: CanvasEngineSnapshot,
      updates: ReadonlyMap<string, CanvasNodeDataPatch>,
    ) => {
      if (updates.size === 0) {
        return
      }

      const mergedUpdates = new Map<string, CanvasNodeDataPatch>()
      for (const [nodeId, patch] of updates) {
        const internalNode = snapshot.nodeLookup.get(nodeId)
        if (!internalNode) {
          continue
        }

        mergedUpdates.set(nodeId, { ...internalNode.node.data, ...patch })
      }
      if (mergedUpdates.size === 0) {
        return
      }

      scheduler.scheduleNodeDataPatches(mergedUpdates)
    },
    scheduleEdgePatches: scheduler.scheduleEdgePatches,
    scheduleViewportTransform: scheduler.scheduleViewportTransform,
    scheduleCameraState: scheduler.scheduleCameraState,
    scheduleCullingDiff: scheduler.scheduleCullingDiff,
    flush: scheduler.flush,
    destroy: () => {
      scheduler.destroy()
      registry.clear()
    },
  }
}
