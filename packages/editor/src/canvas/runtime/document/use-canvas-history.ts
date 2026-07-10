import { useCallback, useEffect, useRef, useState } from 'react'
import { UndoManager } from 'yjs'
import type {
  CanvasHistoryController,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type * as Y from 'yjs'
import { canvasDevLogger } from '../../internal/dev-logger'
import { areStringSetsEqual } from '../../system/canvas-selection'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../document-contract'

const MAX_HISTORY_SIZE = 100
type CanvasHistoryState = Pick<CanvasHistoryController, 'canUndo' | 'canRedo'>
const EMPTY_CANVAS_SELECTION: CanvasSelectionSnapshot = {
  nodeIds: new Set(),
  edgeIds: new Set(),
}

type ActionEntry =
  | {
      type: 'doc'
      before: CanvasSelectionSnapshot
      after?: CanvasSelectionSnapshot
    }
  | { type: 'selection'; before: CanvasSelectionSnapshot; after: CanvasSelectionSnapshot }
type YjsStack = UndoManager['undoStack']

interface UseCanvasHistoryOptions {
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
  selection: Pick<CanvasSelectionController, 'setSelection'>
}

export function useCanvasHistory({ nodesMap, edgesMap, selection }: UseCanvasHistoryOptions) {
  const undoStackRef = useRef<Array<ActionEntry>>([])
  const redoStackRef = useRef<Array<ActionEntry>>([])
  const isUndoRedoingRef = useRef(false)
  const docMutatedRef = useRef(false)
  const selectionRef = useRef<CanvasSelectionSnapshot>(structuredClone(EMPTY_CANVAS_SELECTION))
  const undoManagerRef = useRef<UndoManager | null>(null)
  const [historyState, setHistoryState] = useState<CanvasHistoryState>({
    canUndo: false,
    canRedo: false,
  })

  const pushHistoryEntry = useCallback(
    (stack: Array<ActionEntry>, entry: ActionEntry, yjsStack?: YjsStack) => {
      stack.push(entry)
      if (stack.length <= MAX_HISTORY_SIZE) return

      const droppedEntries = stack.splice(0, stack.length - MAX_HISTORY_SIZE)
      const droppedDocEntryCount = droppedEntries.filter((dropped) => dropped.type === 'doc').length
      if (droppedDocEntryCount > 0) {
        yjsStack?.splice(0, droppedDocEntryCount)
      }
    },
    [],
  )

  const stopCapturing = useCallback(() => {
    undoManagerRef.current?.stopCapturing()
  }, [])

  const syncStore = useCallback(() => {
    setHistoryState({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    })
  }, [])

  const restoreSelection = useCallback(
    (selectionSnapshot: CanvasSelectionSnapshot) => {
      const nextSelection = structuredClone(selectionSnapshot)
      selection.setSelection(nextSelection)
      selectionRef.current = nextSelection
    },
    [selection],
  )

  const undo = useCallback(() => {
    const entry = undoStackRef.current.pop()
    if (!entry) return

    isUndoRedoingRef.current = true
    try {
      if (entry.type === 'doc') {
        const um = undoManagerRef.current
        if (um && um.undoStack.length > 0) {
          const selectionAfter = structuredClone(selectionRef.current)
          um.undo()
          restoreSelection(entry.before)
          pushHistoryEntry(redoStackRef.current, { ...entry, after: selectionAfter }, um.redoStack)
          stopCapturing()
        } else {
          canvasDevLogger.warn('Discarding orphaned doc undo entry (no matching Yjs stack item)')
        }
      } else {
        restoreSelection(entry.before)
        pushHistoryEntry(redoStackRef.current, entry, undoManagerRef.current?.redoStack)
      }
    } finally {
      isUndoRedoingRef.current = false
    }
    syncStore()
  }, [pushHistoryEntry, restoreSelection, stopCapturing, syncStore])

  const redo = useCallback(() => {
    const entry = redoStackRef.current.pop()
    if (!entry) return

    isUndoRedoingRef.current = true
    try {
      if (entry.type === 'doc') {
        const um = undoManagerRef.current
        if (um && um.redoStack.length > 0) {
          um.redo()
          if (entry.after) restoreSelection(entry.after)
          pushHistoryEntry(undoStackRef.current, entry, um.undoStack)
          stopCapturing()
        } else {
          canvasDevLogger.warn(
            'Discarding orphaned doc redo entry (no matching Yjs redo stack item)',
          )
          syncStore()
          return
        }
      } else {
        restoreSelection(entry.after)
        pushHistoryEntry(undoStackRef.current, entry, undoManagerRef.current?.undoStack)
      }
    } finally {
      isUndoRedoingRef.current = false
    }
    syncStore()
  }, [pushHistoryEntry, restoreSelection, stopCapturing, syncStore])

  useEffect(() => {
    const um = new UndoManager([nodesMap, edgesMap], {
      trackedOrigins: new Set([null]),
      captureTimeout: 0,
    })

    undoManagerRef.current = um
    undoStackRef.current = []
    redoStackRef.current = []
    selectionRef.current = structuredClone(EMPTY_CANVAS_SELECTION)
    syncStore()

    const onAdded = () => {
      if (isUndoRedoingRef.current) return
      pushHistoryEntry(
        undoStackRef.current,
        { type: 'doc', before: structuredClone(selectionRef.current) },
        um.undoStack,
      )
      redoStackRef.current = []
      stopCapturing()

      // Prevents selection changes caused as side-effects of doc mutations
      // from being recorded as separate undo entries
      docMutatedRef.current = true
      queueMicrotask(() => {
        docMutatedRef.current = false
      })
      syncStore()
    }

    um.on('stack-item-added', onAdded)

    return () => {
      um.off('stack-item-added', onAdded)
      um.destroy()
      undoManagerRef.current = null
    }
  }, [nodesMap, edgesMap, pushHistoryEntry, stopCapturing, syncStore])

  const onSelectionChange = useCallback(
    (selectionSnapshot: CanvasSelectionSnapshot) => {
      const prev = selectionRef.current
      const nextSelection = structuredClone(selectionSnapshot)
      selectionRef.current = nextSelection

      if (isUndoRedoingRef.current) return
      if (docMutatedRef.current) return

      const same =
        areStringSetsEqual(prev.nodeIds, nextSelection.nodeIds) &&
        areStringSetsEqual(prev.edgeIds, nextSelection.edgeIds)
      if (same) return

      pushHistoryEntry(
        undoStackRef.current,
        {
          type: 'selection',
          before: structuredClone(prev),
          after: structuredClone(nextSelection),
        },
        undoManagerRef.current?.undoStack,
      )
      redoStackRef.current = []
      syncStore()
    },
    [pushHistoryEntry, syncStore],
  )

  return { ...historyState, undo, redo, onSelectionChange }
}
