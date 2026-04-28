import { useCallback, useEffect, useRef } from 'react'
import type {
  RichEmbedActivationPayload,
  RichEmbedLifecycleController,
} from '../embed/use-rich-embed-lifecycle'
import { useCanvasInteractionServices } from '../../runtime/providers/canvas-runtime'
import { useCanvasEngineSelector } from '../../react/use-canvas-engine'
import { isExclusivelySelectedNode } from '../../utils/canvas-selection-utils'
import { areStringSetsEqual } from '../../system/canvas-selection'

interface UseCanvasEditableNodeSessionOptions {
  id: string
  canEdit: boolean
  editing: boolean
  setEditing: (editing: boolean) => void
}

export function useCanvasEditableNodeSession({
  id,
  canEdit,
  editing,
  setEditing,
}: UseCanvasEditableNodeSessionOptions) {
  const { editSession, selection } = useCanvasInteractionServices()
  const selectionState = useCanvasEngineSelector(
    (state) => [state.selection.nodeIds, state.selection.nodeIds.has(id)] as const,
    areEditableSelectionStatesEqual,
  )
  const [selectedNodeIds, isSelected] = selectionState
  const isExclusivelySelected = isExclusivelySelectedNode(selectedNodeIds, id)
  const pendingActivationRef = useRef<RichEmbedActivationPayload | null>(null)
  const editFrameRef = useRef<number | null>(null)
  const hasPendingAutoEdit = editSession.pendingEditNodeId === id

  const scheduleEditingChange = useCallback(
    (nextEditing: boolean, onCommit?: () => void) => {
      if (editFrameRef.current !== null) {
        cancelAnimationFrame(editFrameRef.current)
      }

      editFrameRef.current = requestAnimationFrame(() => {
        editFrameRef.current = null
        setEditing(nextEditing)
        onCommit?.()
      })
    },
    [setEditing],
  )

  useEffect(() => {
    return () => {
      pendingActivationRef.current = null
      if (editFrameRef.current !== null) {
        cancelAnimationFrame(editFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (editing && !isExclusivelySelected && !hasPendingAutoEdit) {
      scheduleEditingChange(false)
    }
  }, [editing, hasPendingAutoEdit, isExclusivelySelected, scheduleEditingChange])

  useEffect(() => {
    if (!canEdit || editing || !hasPendingAutoEdit) {
      return
    }

    if (!isSelected) {
      selection.setSelection({ nodeIds: new Set([id]), edgeIds: new Set() })
      return
    }

    pendingActivationRef.current = editSession.pendingEditNodePoint
      ? { point: editSession.pendingEditNodePoint }
      : null
    scheduleEditingChange(true)
  }, [
    canEdit,
    editSession.pendingEditNodePoint,
    editing,
    hasPendingAutoEdit,
    id,
    isSelected,
    scheduleEditingChange,
    selection,
  ])

  useEffect(() => {
    if (!editing || !hasPendingAutoEdit || selectedNodeIds.size === 0 || isSelected) {
      return
    }

    editSession.setPendingEditNodeId(null)
    editSession.setPendingEditNodePoint(null)
    scheduleEditingChange(false)
  }, [
    editSession,
    editing,
    hasPendingAutoEdit,
    isSelected,
    scheduleEditingChange,
    selectedNodeIds.size,
  ])

  const startEditing = useCallback(
    (point?: { x: number; y: number } | null) => {
      if (!canEdit || !isExclusivelySelected) {
        return
      }

      pendingActivationRef.current = point ? { point } : null
      scheduleEditingChange(true)
    },
    [canEdit, isExclusivelySelected, scheduleEditingChange],
  )

  const stopEditing = useCallback(() => {
    scheduleEditingChange(false)
  }, [scheduleEditingChange])

  const handleDoubleClick = useCallback(
    (event: Pick<React.MouseEvent, 'clientX' | 'clientY'>) => {
      startEditing({ x: event.clientX, y: event.clientY })
    },
    [startEditing],
  )

  const handleActivated = useCallback(() => {
    if (editSession.pendingEditNodeId !== id) {
      return
    }

    editSession.setPendingEditNodeId(null)
    editSession.setPendingEditNodePoint(null)
  }, [editSession, id])

  return {
    editable: editing && isExclusivelySelected,
    editing,
    hasPendingAutoEdit,
    isExclusivelySelected,
    isSelected,
    lifecycle: { pendingActivationRef } satisfies RichEmbedLifecycleController,
    handleActivated,
    handleDoubleClick,
    startEditing,
    stopEditing,
  }
}

function areEditableSelectionStatesEqual(
  left: readonly [ReadonlySet<string>, boolean],
  right: readonly [ReadonlySet<string>, boolean],
) {
  return left[1] === right[1] && areStringSetsEqual(left[0], right[0])
}
