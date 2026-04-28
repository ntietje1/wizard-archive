import { createCanvasDomRegistry } from './canvas-dom-registry'
import { createCanvasRenderScheduler } from './canvas-render-scheduler'
import type { CanvasNodeDataPatch } from '../nodes/canvas-node-modules'
import type { CanvasEngineSnapshot } from './canvas-engine-types'

export interface CanvasDomRuntime {
  registry: ReturnType<typeof createCanvasDomRegistry>
  registerNodeElement: ReturnType<typeof createCanvasDomRegistry>['registerNode']
  registerNodeSurfaceElement: ReturnType<typeof createCanvasDomRegistry>['registerNodeSurface']
  registerStrokeNodePaths: ReturnType<typeof createCanvasDomRegistry>['registerStrokeNodePaths']
  registerEdgeElement: ReturnType<typeof createCanvasDomRegistry>['registerEdge']
  registerEdgePaths: ReturnType<typeof createCanvasDomRegistry>['registerEdgePaths']
  registerViewportElement: ReturnType<typeof createCanvasDomRegistry>['registerViewport']
  registerViewportOverlayElement: ReturnType<
    typeof createCanvasDomRegistry
  >['registerViewportOverlay']
  getViewportSurfaceBounds: ReturnType<typeof createCanvasDomRegistry>['getViewportSurfaceBounds']
  scheduleNodeTransforms: ReturnType<typeof createCanvasRenderScheduler>['scheduleNodeTransforms']
  scheduleEdgePaths: ReturnType<typeof createCanvasRenderScheduler>['scheduleEdgePaths']
  scheduleNodeDataPatches: (
    snapshot: CanvasEngineSnapshot,
    updates: ReadonlyMap<string, CanvasNodeDataPatch>,
  ) => void
  scheduleEdgePatches: ReturnType<typeof createCanvasRenderScheduler>['scheduleEdgePatches']
  scheduleViewportTransform: ReturnType<
    typeof createCanvasRenderScheduler
  >['scheduleViewportTransform']
  scheduleCameraState: ReturnType<typeof createCanvasRenderScheduler>['scheduleCameraState']
  scheduleCullingDiff: ReturnType<typeof createCanvasRenderScheduler>['scheduleCullingDiff']
  flush: ReturnType<typeof createCanvasRenderScheduler>['flush']
  destroy: () => void
}

export function createCanvasDomRuntime(): CanvasDomRuntime {
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
