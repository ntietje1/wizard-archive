import { useCallback, useEffect, useRef, useState } from 'react'
import { UndoManager } from 'yjs'
import type {
  CanvasHistoryController,
  CanvasSelectionController,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'
import { logger } from '~/shared/utils/logger'
import { areStringSetsEqual } from '../../utils/canvas-selection-utils'

const MAX_HISTORY_SIZE = 100
const EMPTY_CANVAS_SELECTION: CanvasSelectionSnapshot = {
  nodeIds: new Set(),
  edgeIds: new Set(),
}
type CanvasHistoryState = Pick<CanvasHistoryController, 'canUndo' | 'canRedo'>

type ActionEntry =
  | { type: 'doc' }
  | { type: 'selection'; before: CanvasSelectionSnapshot; after: CanvasSelectionSnapshot }

interface UseCanvasHistoryOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  selection: Pick<CanvasSelectionController, 'replace'>
}

export function useCanvasHistory({ nodesMap, edgesMap, selection }: UseCanvasHistoryOptions) {
  const undoStackRef = useRef<Array<ActionEntry>>([])
  const redoStackRef = useRef<Array<ActionEntry>>([])
  const isUndoRedoingRef = useRef(false)
  const docMutatedRef = useRef(false)
  const selectionRef = useRef<CanvasSelectionSnapshot>(EMPTY_CANVAS_SELECTION)
  const undoManagerRef = useRef<UndoManager | null>(null)
  const [historyState, setHistoryState] = useState<CanvasHistoryState>({
    canUndo: false,
    canRedo: false,
  })

  const pushHistoryEntry = useCallback((stack: Array<ActionEntry>, entry: ActionEntry) => {
    stack.push(entry)
    if (stack.length > MAX_HISTORY_SIZE) {
      stack.splice(0, stack.length - MAX_HISTORY_SIZE)
    }
  }, [])

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
      selection.replace(nextSelection)
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
          const stackItem = um.undoStack[um.undoStack.length - 1]
          const selBefore = stackItem.meta.get('selection-before') as
            | CanvasSelectionSnapshot
            | undefined
          stackItem.meta.set('selection-after', structuredClone(selectionRef.current))
          um.undo()
          if (selBefore) restoreSelection(selBefore)
          pushHistoryEntry(redoStackRef.current, { type: 'doc' })
          stopCapturing()
        } else {
          logger.warn('Discarding orphaned doc undo entry (no matching Yjs stack item)')
        }
      } else {
        restoreSelection(entry.before)
        pushHistoryEntry(redoStackRef.current, entry)
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
          const stackItem = um.redoStack[um.redoStack.length - 1]
          const selAfter = stackItem.meta.get('selection-after') as
            | CanvasSelectionSnapshot
            | undefined
          um.redo()
          if (selAfter) restoreSelection(selAfter)
          pushHistoryEntry(undoStackRef.current, { type: 'doc' })
          stopCapturing()
        } else {
          logger.warn('Discarding orphaned doc redo entry (no matching Yjs redo stack item)')
          syncStore()
          return
        }
      } else {
        restoreSelection(entry.after)
        pushHistoryEntry(undoStackRef.current, entry)
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
    syncStore()

    const onAdded = (event: { stackItem: { meta: Map<string, unknown> } }) => {
      if (isUndoRedoingRef.current) return
      event.stackItem.meta.set('selection-before', structuredClone(selectionRef.current))
      pushHistoryEntry(undoStackRef.current, { type: 'doc' })
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
      selectionRef.current = selectionSnapshot

      if (isUndoRedoingRef.current) return
      if (docMutatedRef.current) return

      const same =
        areStringSetsEqual(prev.nodeIds, selectionSnapshot.nodeIds) &&
        areStringSetsEqual(prev.edgeIds, selectionSnapshot.edgeIds)
      if (same) return

      pushHistoryEntry(undoStackRef.current, {
        type: 'selection',
        before: structuredClone(prev),
        after: structuredClone(selectionSnapshot),
      })
      redoStackRef.current = []
      syncStore()
    },
    [pushHistoryEntry, syncStore],
  )

  return { ...historyState, undo, redo, onSelectionChange }
}
