import { getMeasuredCanvasNodesFromEngineSnapshot } from '../runtime/document/canvas-measured-nodes'
import type { createCanvasDocumentWriter } from '../runtime/document/use-canvas-document-writer'
import type { useCanvasModifierKeys } from '../runtime/interaction/use-canvas-modifier-keys'
import type { useCanvasPointerRouterController } from '../runtime/interaction/use-canvas-pointer-router'
import type { useCanvasSelectionController } from '../runtime/selection/use-canvas-selection-actions'
import type { useCanvasSessionState } from '../runtime/session/use-canvas-session-state'
import { clampCanvasEdgeStrokeWidth } from '../edges/shared/canvas-edge-style'
import type { CanvasToolStore } from '../stores/canvas-tool-store'
import type { CanvasToolLocalOverlayStore } from '../stores/canvas-tool-local-overlay-store'
import type { createCanvasEngine } from '../system/canvas-engine'
import type { createCanvasViewportController } from '../system/canvas-viewport-controller'
import type { CanvasEdgeCreationDefaults, CanvasToolRuntime } from './canvas-tool-types'

export function createCanvasToolRuntime({
  canvasEngine,
  documentWriter,
  editSession,
  interaction,
  modifiers,
  selection,
  awareness,
  toolStore,
  localOverlayStore,
  viewportController,
}: {
  canvasEngine: ReturnType<typeof createCanvasEngine>
  documentWriter: ReturnType<typeof createCanvasDocumentWriter>
  editSession: ReturnType<typeof useCanvasSessionState>['editSession']
  interaction: ReturnType<typeof useCanvasPointerRouterController>['interaction']
  modifiers: Pick<ReturnType<typeof useCanvasModifierKeys>, 'primaryPressed' | 'shiftPressed'>
  selection: ReturnType<typeof useCanvasSelectionController>
  awareness: ReturnType<typeof useCanvasSessionState>['awareness']
  toolStore: CanvasToolStore
  localOverlayStore: CanvasToolLocalOverlayStore
  viewportController: ReturnType<typeof createCanvasViewportController>
}): CanvasToolRuntime {
  return {
    viewport: {
      screenToCanvasPosition: viewportController.screenToCanvasPosition,
      getZoom: viewportController.getZoom,
    },
    commands: documentWriter,
    query: {
      getNodes: () => [...canvasEngine.getSnapshot().nodes],
      getEdges: () => [...canvasEngine.getSnapshot().edges],
      getMeasuredNodes: () => getMeasuredCanvasNodesFromEngineSnapshot(canvasEngine.getSnapshot()),
    },
    selection,
    interaction,
    modifiers: {
      getShiftPressed: () => modifiers.shiftPressed,
      getPrimaryPressed: () => modifiers.primaryPressed,
    },
    editSession,
    toolState: createCanvasToolStateAdapter(toolStore),
    localOverlay: localOverlayStore.getState(),
    awareness,
  }
}

function createCanvasToolStateAdapter(toolStore: CanvasToolStore): CanvasToolRuntime['toolState'] {
  return {
    getSettings: () => {
      const { edgeType, strokeColor, strokeOpacity, strokeSize } = toolStore.getState()
      return { edgeType, strokeColor, strokeOpacity, strokeSize }
    },
    getActiveTool: () => toolStore.getState().activeTool,
    setActiveTool: (tool) => toolStore.getState().setActiveTool(tool),
    setEdgeType: (type) => toolStore.getState().setEdgeType(type),
    setStrokeColor: (color) => toolStore.getState().setStrokeColor(color),
    setStrokeSize: (size) => toolStore.getState().setStrokeSize(size),
    setStrokeOpacity: (opacity) => toolStore.getState().setStrokeOpacity(opacity),
  }
}

export function getEdgeCreationDefaults(toolStore: CanvasToolStore): CanvasEdgeCreationDefaults {
  const { edgeType, strokeColor, strokeOpacity, strokeSize } = toolStore.getState()
  const opacity = normalizeOpacityPercent(strokeOpacity)

  return {
    type: edgeType,
    style: {
      stroke: strokeColor,
      strokeWidth: clampCanvasEdgeStrokeWidth(strokeSize),
      ...(opacity === undefined ? {} : { opacity }),
    },
  }
}

function normalizeOpacityPercent(opacity: number): number | undefined {
  if (!Number.isFinite(opacity)) {
    return undefined
  }

  const clampedOpacity = Math.max(0, Math.min(100, opacity))
  // Undefined means no opacity override; the renderer treats absence as fully opaque.
  return clampedOpacity >= 100 ? undefined : clampedOpacity / 100
}
