import { useCallback, useEffect, useRef } from 'react'
import type {
  PendingRichEmbedActivationRef,
  RichEmbedActivationPayload,
  RichEmbedActivationTarget,
} from '../../../rich-text/deferred-activation'
import { useCanvasInteractionRuntime } from '../../runtime/providers/canvas-runtime'
import { useCanvasEngineSelector } from '../../react/use-canvas-engine'

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
  const { editSession, selection } = useCanvasInteractionRuntime()
  const { hasSelection, isExclusivelySelected, isSelected } = useCanvasEngineSelector((state) => {
    const selectedNodeIds = state.selection.nodeIds
    return {
      hasSelection: selectedNodeIds.size > 0,
      isExclusivelySelected: selectedNodeIds.size === 1 && selectedNodeIds.has(id),
      isSelected: selectedNodeIds.has(id),
    }
  }, areEditableSelectionStatesEqual)
  const pendingActivationRef: PendingRichEmbedActivationRef =
    useRef<RichEmbedActivationTarget | null>(null)
  const editFrameRef = useRef<number | null>(null)
  const hasPendingAutoEdit = editSession.pendingEdit?.nodeId === id

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
    if (!hasPendingAutoEdit) {
      return
    }

    if (canEdit && (!hasSelection || isSelected)) {
      return
    }

    editSession.setPendingEdit(null)
    pendingActivationRef.current = null

    if (editing) {
      scheduleEditingChange(false)
    }
  }, [
    canEdit,
    editSession,
    editing,
    hasPendingAutoEdit,
    hasSelection,
    isSelected,
    scheduleEditingChange,
  ])

  useEffect(() => {
    if (!canEdit || editing || !hasPendingAutoEdit) {
      return
    }

    if (!isExclusivelySelected) {
      selection.setSelection({ nodeIds: new Set([id]), edgeIds: new Set() })
      return
    }

    pendingActivationRef.current = editSession.pendingEdit
      ? { kind: 'point', payload: { point: editSession.pendingEdit.point } }
      : { kind: 'end' }
    scheduleEditingChange(true)
  }, [
    canEdit,
    editSession.pendingEdit,
    editing,
    hasPendingAutoEdit,
    id,
    isExclusivelySelected,
    scheduleEditingChange,
    selection,
  ])

  const startEditing = useCallback(
    (point?: RichEmbedActivationPayload) => {
      if (!canEdit) {
        return
      }

      if (!isExclusivelySelected) {
        selection.setSelection({ nodeIds: new Set([id]), edgeIds: new Set() })
      }

      pendingActivationRef.current = point ? { kind: 'point', payload: point } : { kind: 'end' }
      scheduleEditingChange(true)
    },
    [canEdit, id, isExclusivelySelected, scheduleEditingChange, selection],
  )

  const stopEditing = useCallback(() => {
    scheduleEditingChange(false)
  }, [scheduleEditingChange])

  const handleDoubleClick = useCallback(
    (event: Pick<React.MouseEvent, 'clientX' | 'clientY'>) => {
      startEditing({
        point: { x: event.clientX, y: event.clientY },
      })
    },
    [startEditing],
  )

  const handleActivated = useCallback(() => {
    if (editSession.pendingEdit?.nodeId !== id) {
      return
    }

    editSession.setPendingEdit(null)
  }, [editSession, id])

  return {
    editable: canEdit && editing && isExclusivelySelected,
    editing,
    hasPendingAutoEdit,
    isExclusivelySelected,
    isSelected,
    handleActivated,
    handleDoubleClick,
    pendingActivationRef,
    startEditing,
    stopEditing,
  }
}

function areEditableSelectionStatesEqual(
  left: { hasSelection: boolean; isExclusivelySelected: boolean; isSelected: boolean },
  right: { hasSelection: boolean; isExclusivelySelected: boolean; isSelected: boolean },
) {
  return (
    left.hasSelection === right.hasSelection &&
    left.isExclusivelySelected === right.isExclusivelySelected &&
    left.isSelected === right.isSelected
  )
}
