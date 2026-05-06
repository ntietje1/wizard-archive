import { useRef } from 'react'
import { areCanvasSelectionsEqual } from '../../system/canvas-selection'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'

interface UseCanvasSelectionControllerOptions {
  canvasEngine: CanvasEngine
  onSelectionChange?: (selection: CanvasSelectionSnapshot) => void
  setLocalSelection?: (nodeIds: ReadonlySet<string> | null) => void
}

export function useCanvasSelectionController({
  canvasEngine,
  onSelectionChange,
  setLocalSelection,
}: UseCanvasSelectionControllerOptions): CanvasSelectionController {
  const onSelectionChangeRef = useRef(onSelectionChange)
  const setLocalSelectionRef = useRef(setLocalSelection)
  onSelectionChangeRef.current = onSelectionChange
  setLocalSelectionRef.current = setLocalSelection

  const controllerRef = useRef<CanvasSelectionController | null>(null)
  const canvasEngineRef = useRef<CanvasEngine | null>(null)
  if (!controllerRef.current || canvasEngineRef.current !== canvasEngine) {
    canvasEngineRef.current = canvasEngine
    controllerRef.current = createCanvasSelectionController({
      canvasEngine,
      onSelectionChange: (selection) => onSelectionChangeRef.current?.(selection),
      setLocalSelection: (nodeIds) => setLocalSelectionRef.current?.(nodeIds),
    })
  }

  return controllerRef.current
}

function createCanvasSelectionController({
  canvasEngine,
  onSelectionChange,
  setLocalSelection,
}: {
  canvasEngine: CanvasEngine
  onSelectionChange: (selection: CanvasSelectionSnapshot) => void
  setLocalSelection: (nodeIds: ReadonlySet<string> | null) => void
}): CanvasSelectionController {
  const getSnapshot = () => {
    const { selection } = canvasEngine.getSnapshot()
    return {
      nodeIds: selection.nodeIds,
      edgeIds: selection.edgeIds,
    }
  }

  const notifySelectionChange = (
    previous: CanvasSelectionSnapshot,
    next: CanvasSelectionSnapshot,
  ) => {
    if (areCanvasSelectionsEqual(previous, next)) {
      return
    }

    setLocalSelection(next.nodeIds.size > 0 ? next.nodeIds : null)
    onSelectionChange(next)
  }

  const applySelection = (selection: CanvasSelectionSnapshot) => {
    const previous = getSnapshot()
    canvasEngine.setSelection(selection)
    notifySelectionChange(previous, getSnapshot())
  }

  return {
    getSnapshot,
    setSelection: applySelection,
    clearSelection: () => {
      applySelection({ nodeIds: new Set(), edgeIds: new Set() })
    },
    toggleNode: (nodeId, additive) => {
      const previous = getSnapshot()
      canvasEngine.toggleNodeSelection(nodeId, additive)
      notifySelectionChange(previous, getSnapshot())
    },
    toggleEdge: (edgeId, additive) => {
      const previous = getSnapshot()
      canvasEngine.toggleEdgeSelection(edgeId, additive)
      notifySelectionChange(previous, getSnapshot())
    },
    beginGesture: (kind, mode) => {
      canvasEngine.beginSelectionGesture(kind, mode)
    },
    setGesturePreview: (selection) => {
      canvasEngine.setSelectionGesturePreview(selection)
    },
    commitGesture: () => {
      const previous = getSnapshot()
      canvasEngine.commitSelectionGesture()
      notifySelectionChange(previous, getSnapshot())
    },
    cancelGesture: () => {
      canvasEngine.cancelSelectionGesture()
    },
  }
}
