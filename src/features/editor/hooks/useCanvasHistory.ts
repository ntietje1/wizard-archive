import { useCallback, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { UndoManager } from 'yjs'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

type ActionEntry =
  | { type: 'doc' }
  | { type: 'selection'; before: Array<string>; after: Array<string> }

interface UseCanvasHistoryOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
}

export function useCanvasHistory({
  nodesMap,
  edgesMap,
}: UseCanvasHistoryOptions) {
  const reactFlow = useReactFlow()
  const undoStackRef = useRef<Array<ActionEntry>>([])
  const redoStackRef = useRef<Array<ActionEntry>>([])
  const isUndoRedoingRef = useRef(false)
  const docMutatedRef = useRef(false)
  const selectionRef = useRef<Array<string>>([])
  const undoManagerRef = useRef<UndoManager | null>(null)

  const syncStore = useCallback(() => {
    const { setHistory } = useCanvasToolStore.getState()
    setHistory({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
      undo,
      redo,
    })
  }, []) // undo/redo are stable via undoManagerRef — defined below, bound once

  const restoreSelection = useCallback(
    (nodeIds: Array<string>) => {
      const idSet = new Set(nodeIds)
      reactFlow.setNodes((nodes) =>
        nodes.map((n) => ({ ...n, selected: idSet.has(n.id) })),
      )
      selectionRef.current = nodeIds
    },
    [reactFlow],
  )

  const undo = useCallback(() => {
    const entry = undoStackRef.current.pop()
    if (!entry) return

    isUndoRedoingRef.current = true

    if (entry.type === 'doc') {
      const um = undoManagerRef.current
      if (um && um.undoStack.length > 0) {
        const stackItem = um.undoStack[um.undoStack.length - 1]
        const selBefore = stackItem.meta.get('selection-before') as
          | Array<string>
          | undefined
        stackItem.meta.set('selection-after', selectionRef.current.slice())
        um.undo()
        if (selBefore) restoreSelection(selBefore)
      }
      redoStackRef.current.push({ type: 'doc' })
    } else {
      restoreSelection(entry.before)
      redoStackRef.current.push(entry)
    }

    isUndoRedoingRef.current = false
    syncStore()
  }, [restoreSelection, syncStore])

  const redo = useCallback(() => {
    const entry = redoStackRef.current.pop()
    if (!entry) return

    isUndoRedoingRef.current = true

    if (entry.type === 'doc') {
      const um = undoManagerRef.current
      if (um && um.redoStack.length > 0) {
        const stackItem = um.redoStack[um.redoStack.length - 1]
        const selAfter = stackItem.meta.get('selection-after') as
          | Array<string>
          | undefined
        um.redo()
        if (selAfter) restoreSelection(selAfter)
      }
      undoStackRef.current.push({ type: 'doc' })
    } else {
      restoreSelection(entry.after)
      undoStackRef.current.push(entry)
    }

    isUndoRedoingRef.current = false
    syncStore()
  }, [restoreSelection, syncStore])

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
      event.stackItem.meta.set('selection-before', selectionRef.current.slice())
      undoStackRef.current.push({ type: 'doc' })
      redoStackRef.current = []

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
  }, [nodesMap, edgesMap, syncStore])

  useEffect(() => {
    syncStore()
  }, [undo, redo, syncStore])

  const onSelectionChange = useCallback(
    (nodeIds: Array<string>) => {
      const prev = selectionRef.current
      selectionRef.current = nodeIds

      if (isUndoRedoingRef.current) return
      if (docMutatedRef.current) return

      const same =
        prev.length === nodeIds.length &&
        prev.every((id, i) => id === nodeIds[i])
      if (same) return

      undoStackRef.current.push({
        type: 'selection',
        before: prev,
        after: nodeIds,
      })
      redoStackRef.current = []
      syncStore()
    },
    [syncStore],
  )

  return { onSelectionChange }
}
