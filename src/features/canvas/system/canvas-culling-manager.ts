import {
  computeCanvasCullingSnapshot,
  createEmptyCanvasCullingSnapshot,
  getCanvasCullingDiff,
  isCanvasCullingDiffEmpty,
} from './canvas-culling'
import type { CanvasCullingDiff, CanvasCullingSnapshot } from './canvas-culling'
import type { CanvasEngineSnapshot } from './canvas-engine-types'

export interface CanvasCullingManager {
  reconcile: (options: {
    snapshot: CanvasEngineSnapshot
    surfaceBounds: Pick<DOMRect, 'width' | 'height'> | null
    draggingNodeIds: ReadonlySet<string>
  }) => CanvasCullingDiff | null
  reset: () => void
}

export function createCanvasCullingManager(): CanvasCullingManager {
  let cullingSnapshot: CanvasCullingSnapshot = createEmptyCanvasCullingSnapshot()

  return {
    reconcile: ({ snapshot, surfaceBounds, draggingNodeIds }) => {
      const nextCullingSnapshot = computeCanvasCullingSnapshot({
        viewport: snapshot.viewport,
        surfaceBounds,
        nodeLookup: snapshot.nodeLookup,
        edges: snapshot.edges,
        selection: snapshot.selection,
        draggingNodeIds,
      })
      const diff = getCanvasCullingDiff(cullingSnapshot, nextCullingSnapshot)
      cullingSnapshot = nextCullingSnapshot

      return isCanvasCullingDiffEmpty(diff) ? null : diff
    },
    reset: () => {
      cullingSnapshot = createEmptyCanvasCullingSnapshot()
    },
  }
}
