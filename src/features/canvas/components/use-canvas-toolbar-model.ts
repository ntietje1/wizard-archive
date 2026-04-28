import { useRef } from 'react'
import {
  getCanvasEdgeInspectableProperties,
  normalizeCanvasEdge,
  resolveCanvasEdgeType,
} from '../edges/canvas-edge-registry'
import type { CanvasEdgePatch, CanvasEdgeType } from '../edges/canvas-edge-types'
import { useCanvasDocumentServices, useCanvasDomRuntime } from '../runtime/providers/canvas-runtime'
import {
  getCanvasNodeInspectableProperties,
  normalizeCanvasNode,
} from '../nodes/canvas-node-modules'
import type { CanvasNodeDataPatch } from '../nodes/canvas-node-modules'
import { measureCanvasPerformance } from '../runtime/performance/canvas-performance-metrics'
import { canvasToolSpecs } from '../tools/canvas-tool-modules'
import { useCanvasToolPropertyContext, useCanvasToolStore } from '../stores/canvas-tool-store'
import { useCanvasEngine, useCanvasEngineSelector } from '../react/use-canvas-engine'
import {
  areCanvasPropertyEdgesEqual,
  areCanvasPropertyNodesEqual,
  selectCanvasSelectedEdges,
  selectCanvasSelectedNodes,
} from '../system/canvas-engine-selectors'
import { createCanvasPropertySessionController } from '../system/canvas-property-session-controller'
import { areCanvasSelectionsEqual } from '../system/canvas-selection'
import { resolveCanvasProperties } from '../properties/resolve-canvas-properties'
import { EMPTY_CANVAS_INSPECTABLE_PROPERTIES } from '../properties/canvas-property-types'
import type {
  CanvasInspectableProperties,
  CanvasResolvedProperty,
} from '../properties/canvas-property-types'
import type { CanvasPropertyPatchSet } from '../system/canvas-property-session-controller'
import type { CanvasToolId, CanvasToolPropertyContext } from '../tools/canvas-tool-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../types/canvas-domain-types'
import { useShallow } from 'zustand/shallow'

export function useCanvasToolbarModel() {
  const canvasEngine = useCanvasEngine()
  const domRuntime = useCanvasDomRuntime()
  const { nodeActions, commands, documentWriter } = useCanvasDocumentServices()
  const selectedNodes = useCanvasEngineSelector(
    selectCanvasSelectedNodes,
    areCanvasPropertyNodesEqual,
  )
  const selectedEdges = useCanvasEngineSelector(
    selectCanvasSelectedEdges,
    areCanvasPropertyEdgesEqual,
  )
  const selectionSnapshot = useCanvasEngineSelector(
    (state) => ({
      nodeIds: state.selection.nodeIds,
      edgeIds: state.selection.edgeIds,
    }),
    areCanvasSelectionsEqual,
  )
  const { activeTool, edgeType, setEdgeType } = useCanvasToolStore(
    useShallow((state) => ({
      activeTool: state.activeTool,
      edgeType: state.edgeType,
      setEdgeType: state.setEdgeType,
    })),
  )
  const toolPropertyContext = useCanvasToolPropertyContext()

  const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0
  const hasOnlySelectedEdges = selectedNodes.length === 0 && selectedEdges.length > 0
  const showsEdgeToolDefaults = !hasSelection && activeTool === 'edge'
  const pendingNodeDataPatchesRef = useRef<Map<string, CanvasNodeDataPatch> | null>(null)
  const pendingEdgePatchesRef = useRef<Map<string, CanvasEdgePatch> | null>(null)
  const propertySessionControllerRef = useRef<ReturnType<
    typeof createCanvasPropertySessionController
  > | null>(null)
  propertySessionControllerRef.current ??= createCanvasPropertySessionController()
  const propertySessionController = propertySessionControllerRef.current

  const patchNodeDataForProperty = (nodeId: string, data: CanvasNodeDataPatch) => {
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

  const patchEdgeForProperty = (edgeId: string, patch: CanvasEdgePatch) => {
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

  const properties = measureCanvasPerformance(
    'canvas.toolbar.resolve-properties',
    {
      selectedEdgeCount: selectedEdges.length,
      selectedNodeCount: selectedNodes.length,
    },
    () =>
      resolveProperties(
        activeTool,
        selectedNodes,
        selectedEdges,
        patchNodeDataForProperty,
        patchEdgeForProperty,
        toolPropertyContext,
      ),
  )

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
        selectedEdgeCount: selectedEdges.length,
        selectedNodeCount: selectedNodes.length,
      },
      () => {
        if (selectedNodes.length === 0 && selectedEdges.length === 0) {
          applyChange()
          return
        }

        commitPropertyPatches(collectPropertyPatches(applyChange))
      },
    )
  }

  const runPropertyPreviewChange = (applyChange: () => void) => {
    const selectedNodeCount = selectedNodes.length
    const selectedEdgeCount = selectedEdges.length

    if (selectedNodeCount === 0 && selectedEdgeCount === 0) {
      applyChange()
      return
    }

    propertySessionController.startPropertySession({
      collectPatches: collectPropertyPatches,
      previewPatches: previewPropertyPatches,
      commitPatches: (patches) => {
        measureCanvasPerformance(
          'canvas.toolbar.commit-property-preview',
          {
            selectedEdgeCount,
            selectedNodeCount,
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

  const setSelectedEdgesType = (type: CanvasEdgeType) => {
    runPropertyChange(() => {
      selectedEdges.forEach((edge) => {
        if (resolveCanvasEdgeType(edge.type) === type) return

        patchEdgeForProperty(edge.id, { type })
      })
    })
  }

  return {
    commands,
    edgeType,
    hasOnlySelectedEdges,
    hasSelection,
    properties,
    selectedEdgeType: getSharedSelectedEdgeType(selectedEdges),
    selectionSnapshot,
    setEdgeType,
    setSelectedEdgesType,
    showsEdgeToolDefaults,
    runPropertyChange,
    runPropertyPreviewChange,
    commitPropertyPreviewChange: propertySessionController.commitPropertySession,
    cancelPropertyPreviewChange: propertySessionController.cancelPropertySession,
  }
}

function resolveProperties(
  activeTool: CanvasToolId,
  selectedNodes: ReadonlyArray<CanvasDocumentNode>,
  selectedEdges: ReadonlyArray<CanvasDocumentEdge>,
  patchNodeData: (nodeId: string, data: CanvasNodeDataPatch) => void,
  patchEdge: (edgeId: string, patch: CanvasEdgePatch) => void,
  toolPropertyContext: CanvasToolPropertyContext,
): Array<CanvasResolvedProperty> {
  if (selectedNodes.length > 0 || selectedEdges.length > 0) {
    const selectedProperties = [
      ...selectedNodes.map<CanvasInspectableProperties>((node) =>
        getCanvasNodeInspectableProperties(normalizeCanvasNode(node), patchNodeData),
      ),
      ...selectedEdges.map<CanvasInspectableProperties>((edge) =>
        getCanvasEdgeInspectableProperties(normalizeCanvasEdge(edge), patchEdge),
      ),
    ]

    return resolveCanvasProperties(selectedProperties)
  }

  return resolveCanvasProperties([
    canvasToolSpecs[activeTool]?.properties?.(toolPropertyContext) ??
      EMPTY_CANVAS_INSPECTABLE_PROPERTIES,
  ])
}

function getSharedSelectedEdgeType(edges: ReadonlyArray<CanvasDocumentEdge>) {
  const firstEdgeType = edges[0] ? resolveCanvasEdgeType(edges[0].type) : null
  return firstEdgeType && edges.every((edge) => resolveCanvasEdgeType(edge.type) === firstEdgeType)
    ? firstEdgeType
    : null
}
