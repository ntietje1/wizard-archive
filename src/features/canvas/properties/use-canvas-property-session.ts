import { useRef } from 'react'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'
import type { CanvasNodeDataPatch } from '../nodes/canvas-node-modules'
import type { CanvasEngine } from '../system/canvas-engine'
import type { CanvasDomRuntime } from '../system/canvas-dom-runtime'
import { createCanvasPropertySessionController } from '../system/canvas-property-session-controller'
import type { CanvasPropertyPatchSet } from '../system/canvas-property-session-controller'
import { measureCanvasPerformance } from '../runtime/performance/canvas-performance-metrics'
import type { CanvasDocumentWriter, CanvasNodeActions } from '../tools/canvas-tool-types'

interface CanvasPropertySession {
  cancelPropertyPreviewChange: () => void
  commitPropertyPreviewChange: (applyChange?: () => void) => void
  patchEdge: (edgeId: string, patch: CanvasEdgePatch) => void
  patchNodeData: (nodeId: string, data: CanvasNodeDataPatch) => void
  runPropertyChange: (applyChange: () => void) => void
  runPropertyPreviewChange: (applyChange: () => void) => void
}

export function useCanvasPropertySession({
  canvasEngine,
  domRuntime,
  documentWriter,
  nodeActions,
  selectedEdgeCount,
  selectedNodeCount,
}: {
  canvasEngine: CanvasEngine
  domRuntime: CanvasDomRuntime
  documentWriter: CanvasDocumentWriter
  nodeActions: CanvasNodeActions
  selectedEdgeCount: number
  selectedNodeCount: number
}): CanvasPropertySession {
  const pendingNodeDataPatchesRef = useRef<Map<string, CanvasNodeDataPatch> | null>(null)
  const pendingEdgePatchesRef = useRef<Map<string, CanvasEdgePatch> | null>(null)
  const selectionCountsRef = useRef({ selectedEdgeCount, selectedNodeCount })
  selectionCountsRef.current = { selectedEdgeCount, selectedNodeCount }
  const propertySessionControllerRef = useRef<ReturnType<
    typeof createCanvasPropertySessionController
  > | null>(null)
  propertySessionControllerRef.current ??= createCanvasPropertySessionController()
  const propertySessionController = propertySessionControllerRef.current

  const patchNodeData = (nodeId: string, data: CanvasNodeDataPatch) => {
    const pendingNodeDataPatches = pendingNodeDataPatchesRef.current
    if (!pendingNodeDataPatches) {
      const updates = new Map([[nodeId, data]])
      domRuntime.scheduleNodeDataPatches(canvasEngine.getSnapshot(), updates)
      documentWriter.patchNodeData(updates)
      return
    }

    pendingNodeDataPatches.set(nodeId, {
      ...pendingNodeDataPatches.get(nodeId),
      ...data,
    })
  }

  const patchEdge = (edgeId: string, patch: CanvasEdgePatch) => {
    const pendingEdgePatches = pendingEdgePatchesRef.current
    if (!pendingEdgePatches) {
      const updates = new Map([[edgeId, patch]])
      domRuntime.scheduleEdgePatches(updates)
      documentWriter.patchEdges(updates)
      return
    }

    const existingPatch = pendingEdgePatches.get(edgeId)
    pendingEdgePatches.set(
      edgeId,
      existingPatch
        ? {
            ...existingPatch,
            ...patch,
            style: patch.style ? { ...existingPatch.style, ...patch.style } : existingPatch.style,
          }
        : patch,
    )
  }

  const collectPropertyPatches = (applyChange: () => void): CanvasPropertyPatchSet => {
    pendingNodeDataPatchesRef.current = new Map()
    pendingEdgePatchesRef.current = new Map()
    try {
      applyChange()
      return {
        nodeDataPatches: pendingNodeDataPatchesRef.current,
        edgePatches: pendingEdgePatchesRef.current,
      }
    } finally {
      pendingNodeDataPatchesRef.current = null
      pendingEdgePatchesRef.current = null
    }
  }

  const previewPropertyPatches = (patches: CanvasPropertyPatchSet) => {
    domRuntime.scheduleNodeDataPatches(canvasEngine.getSnapshot(), patches.nodeDataPatches)
    domRuntime.scheduleEdgePatches(patches.edgePatches)
  }

  const commitPropertyPatches = (patches: CanvasPropertyPatchSet) => {
    const applyCommittedPatches = () => {
      previewPropertyPatches(patches)
      documentWriter.patchNodeData(patches.nodeDataPatches)
      documentWriter.patchEdges(patches.edgePatches)
    }

    if (nodeActions.transact) {
      nodeActions.transact(applyCommittedPatches)
      return
    }

    applyCommittedPatches()
  }

  const runPropertyChange = (applyChange: () => void) => {
    measureCanvasPerformance(
      'canvas.toolbar.apply-property',
      {
        selectedEdgeCount,
        selectedNodeCount,
      },
      () => {
        if (selectedNodeCount === 0 && selectedEdgeCount === 0) {
          applyChange()
          return
        }

        commitPropertyPatches(collectPropertyPatches(applyChange))
      },
    )
  }

  const runPropertyPreviewChange = (applyChange: () => void) => {
    if (selectedNodeCount === 0 && selectedEdgeCount === 0) {
      applyChange()
      return
    }

    propertySessionController.startPropertySession({
      collectPatches: collectPropertyPatches,
      previewPatches: previewPropertyPatches,
      // commitPatches can run later; preview metrics use direct counts because they run synchronously here.
      commitPatches: (patches) => {
        const counts = selectionCountsRef.current
        measureCanvasPerformance(
          'canvas.toolbar.commit-property-preview',
          {
            selectedEdgeCount: counts.selectedEdgeCount,
            selectedNodeCount: counts.selectedNodeCount,
          },
          () => commitPropertyPatches(patches),
        )
      },
    })
    measureCanvasPerformance(
      'canvas.toolbar.preview-property',
      {
        selectedEdgeCount,
        selectedNodeCount,
      },
      () => propertySessionController.updatePropertyPreview(applyChange),
    )
  }

  return {
    cancelPropertyPreviewChange: propertySessionController.cancelPropertySession,
    commitPropertyPreviewChange: propertySessionController.commitPropertySession,
    patchEdge,
    patchNodeData,
    runPropertyChange,
    runPropertyPreviewChange,
  }
}
