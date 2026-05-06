import { getMeasuredCanvasNodesFromEngineSnapshot } from './document/canvas-measured-nodes'
import type { createCanvasDocumentWriter } from './document/use-canvas-document-writer'
import type { useCanvasModifierKeys } from './interaction/use-canvas-modifier-keys'
import type { useCanvasPointerRouterController } from './interaction/use-canvas-pointer-router'
import type { useCanvasSelectionController } from './selection/use-canvas-selection-actions'
import type { useCanvasSessionState } from './session/use-canvas-session-state'
import { clampCanvasEdgeStrokeWidth } from '../edges/shared/canvas-edge-style'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { createCanvasEngine } from '../system/canvas-engine'
import type { createCanvasViewportController } from '../system/canvas-viewport-controller'
import type { CanvasEdgeCreationDefaults, CanvasToolRuntime } from '../tools/canvas-tool-types'

export function createCanvasToolRuntime({
  canvasEngine,
  documentWriter,
  editSession,
  interaction,
  modifiers,
  selection,
  awareness,
  viewportController,
}: {
  canvasEngine: ReturnType<typeof createCanvasEngine>
  documentWriter: ReturnType<typeof createCanvasDocumentWriter>
  editSession: ReturnType<typeof useCanvasSessionState>['editSession']
  interaction: ReturnType<typeof useCanvasPointerRouterController>['interaction']
  modifiers: Pick<ReturnType<typeof useCanvasModifierKeys>, 'primaryPressed' | 'shiftPressed'>
  selection: ReturnType<typeof useCanvasSelectionController>
  awareness: ReturnType<typeof useCanvasSessionState>['awareness']
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
    toolState: createCanvasToolStateAdapter(),
    awareness,
  }
}

function createCanvasToolStateAdapter(): CanvasToolRuntime['toolState'] {
  return {
    getSettings: () => {
      const { edgeType, strokeColor, strokeOpacity, strokeSize } = useCanvasToolStore.getState()
      return { edgeType, strokeColor, strokeOpacity, strokeSize }
    },
    getActiveTool: () => useCanvasToolStore.getState().activeTool,
    setActiveTool: (tool) => useCanvasToolStore.getState().setActiveTool(tool),
    setEdgeType: (type) => useCanvasToolStore.getState().setEdgeType(type),
    setStrokeColor: (color) => useCanvasToolStore.getState().setStrokeColor(color),
    setStrokeSize: (size) => useCanvasToolStore.getState().setStrokeSize(size),
    setStrokeOpacity: (opacity) => useCanvasToolStore.getState().setStrokeOpacity(opacity),
  }
}

export function getEdgeCreationDefaults(): CanvasEdgeCreationDefaults {
  const { edgeType, strokeColor, strokeOpacity, strokeSize } = useCanvasToolStore.getState()

  return {
    type: edgeType,
    style: {
      stroke: strokeColor,
      strokeWidth: clampCanvasEdgeStrokeWidth(strokeSize),
      opacity: normalizeOpacityPercent(strokeOpacity),
    },
  }
}

/**
 * Converts an opacity percentage into a renderer opacity override.
 *
 * @param opacity Percentage value; callers normally provide 0-100.
 * @returns A 0-1 opacity fraction, or undefined for non-finite input and fully opaque values.
 *
 * Values are clamped into 0-100. Percentages >= 100 return undefined because the renderer
 * treats absence of an opacity override as fully opaque.
 */
function normalizeOpacityPercent(opacity: number): number | undefined {
  if (!Number.isFinite(opacity)) {
    return undefined
  }

  const clampedOpacity = Math.max(0, Math.min(100, opacity))
  // Undefined means no opacity override; the renderer treats absence as fully opaque.
  return clampedOpacity >= 100 ? undefined : clampedOpacity / 100
}
