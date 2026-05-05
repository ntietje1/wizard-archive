import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { resolveCanvasEdgeType } from '../edges/canvas-edge-registry'
import type { CanvasEdgeType } from '../edges/canvas-edge-types'
import {
  useCanvasDocumentRuntime,
  useCanvasInteractionRuntime,
  useCanvasViewportRuntime,
} from '../runtime/providers/canvas-runtime'
import { useCanvasRichTextFormattingSnapshot } from '../nodes/shared/canvas-rich-text-formatting-session'
import { measureCanvasPerformance } from '../runtime/performance/canvas-performance-metrics'
import { useCanvasToolPropertyContext, useCanvasToolStore } from '../stores/canvas-tool-store'
import { useCanvasEngine, useCanvasEngineSelector } from '../react/use-canvas-engine'
import {
  areCanvasPropertyEdgesEqual,
  areCanvasPropertyNodesEqual,
  selectCanvasSelectedEdges,
  selectCanvasSelectedNodes,
} from '../system/canvas-engine-selectors'
import { areCanvasSelectionsEqual } from '../system/canvas-selection'
import {
  getSharedSelectedEdgeType,
  resolveCanvasSelectionProperties,
} from '../properties/resolve-canvas-selection-properties'
import { useCanvasPropertySession } from '../properties/use-canvas-property-session'
import { useOptionalActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useShallow } from 'zustand/shallow'

export function useCanvasToolbarModel() {
  const canvasEngine = useCanvasEngine()
  const { domRuntime } = useCanvasViewportRuntime()
  const { commands, documentWriter } = useCanvasDocumentRuntime()
  const { nodeActions } = useCanvasInteractionRuntime()
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
  const activeSidebarItems = useOptionalActiveSidebarItems()
  const activeFormattingSnapshot = useCanvasRichTextFormattingSnapshot()

  const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0
  const hasOnlySelectedEdges = selectedNodes.length === 0 && selectedEdges.length > 0
  const showsEdgeToolDefaults = !hasSelection && activeTool === 'edge'
  const {
    cancelPropertyPreviewChange,
    commitPropertyPreviewChange,
    patchEdge,
    patchNodeData,
    runPropertyChange,
    runPropertyPreviewChange,
  } = useCanvasPropertySession({
    canvasEngine,
    domRuntime,
    documentWriter,
    nodeActions,
    selectedEdgeCount: selectedEdges.length,
    selectedNodeCount: selectedNodes.length,
  })

  const properties = measureCanvasPerformance(
    'canvas.toolbar.resolve-properties',
    {
      selectedEdgeCount: selectedEdges.length,
      selectedNodeCount: selectedNodes.length,
    },
    () =>
      resolveCanvasSelectionProperties({
        activeTool,
        activeFormattingSnapshot,
        isNoteEmbed: (node) => {
          const sidebarItemId =
            node.type === 'embed' && typeof node.data.sidebarItemId === 'string'
              ? node.data.sidebarItemId
              : null
          return sidebarItemId
            ? activeSidebarItems?.itemsMap.get(sidebarItemId)?.type === SIDEBAR_ITEM_TYPES.notes
            : false
        },
        patchEdge,
        patchNodeData,
        selectedEdges,
        selectedNodes,
        toolPropertyContext,
      }),
  )

  const setSelectedEdgesType = (type: CanvasEdgeType) => {
    runPropertyChange(() => {
      selectedEdges.forEach((edge) => {
        if (resolveCanvasEdgeType(edge.type) === type) return

        patchEdge(edge.id, { type })
      })
    })
  }
  const propertiesSection =
    properties.length > 0
      ? {
          properties,
          runPropertyChange,
          runPropertyPreviewChange,
          commitPropertyPreviewChange,
          cancelPropertyPreviewChange,
        }
      : null
  const edgeTypeSection = hasOnlySelectedEdges
    ? {
        selectedType: getSharedSelectedEdgeType(selectedEdges),
        setType: setSelectedEdgesType,
      }
    : showsEdgeToolDefaults
      ? {
          selectedType: edgeType,
          setType: setEdgeType,
        }
      : null
  const reorderSection = hasSelection
    ? {
        commands,
        selection: selectionSnapshot,
      }
    : null

  return {
    edgeTypeSection,
    hasContent: propertiesSection !== null || edgeTypeSection !== null || reorderSection !== null,
    propertiesSection,
    reorderSection,
  }
}
