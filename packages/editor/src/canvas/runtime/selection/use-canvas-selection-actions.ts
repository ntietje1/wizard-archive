import { useRef } from 'react'
import { areCanvasSelectionsEqual } from '../../system/canvas-selection'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'

interface UseCanvasSelectionControllerOptions {
  canvasEngine: CanvasEngine
  onSelectionChange?: (selection: CanvasSelectionSnapshot) => void
  setLocalSelection?: (selection: CanvasSelectionSnapshot | null) => void
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
      setLocalSelection: (selection) => setLocalSelectionRef.current?.(selection),
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
  setLocalSelection: (selection: CanvasSelectionSnapshot | null) => void
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

    setLocalSelection(next.nodeIds.size > 0 || next.edgeIds.size > 0 ? next : null)
    onSelectionChange(next)
  }

  const mutateSelection = (mutate: () => void) => {
    const previous = getSnapshot()
    mutate()
    notifySelectionChange(previous, getSnapshot())
  }

  return {
    getSnapshot,
    setSelection: (selection) => {
      mutateSelection(() => canvasEngine.setSelection(selection))
    },
    clearSelection: () => {
      mutateSelection(() => canvasEngine.setSelection({ nodeIds: new Set(), edgeIds: new Set() }))
    },
    toggleNode: (nodeId, additive) => {
      mutateSelection(() => canvasEngine.toggleNodeSelection(nodeId, additive))
    },
    toggleEdge: (edgeId, additive) => {
      mutateSelection(() => canvasEngine.toggleEdgeSelection(edgeId, additive))
    },
    beginGesture: (kind, mode) => {
      canvasEngine.beginSelectionGesture(kind, mode)
    },
    setGesturePreview: (selection) => {
      canvasEngine.setSelectionGesturePreview(selection)
    },
    commitGesture: () => {
      mutateSelection(() => canvasEngine.commitSelectionGesture())
    },
    cancelGesture: () => {
      canvasEngine.cancelSelectionGesture()
    },
  }
}
