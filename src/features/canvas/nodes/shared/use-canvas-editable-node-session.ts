import { useCallback, useEffect, useRef } from 'react'
import type {
  RichEmbedActivationPayload,
  RichEmbedLifecycleController,
} from '../embed/use-rich-embed-lifecycle'
import { useCanvasRuntime } from '../../runtime/providers/canvas-runtime'
import {
  useIsCanvasNodeSelected,
  useSelectedCanvasNodeIds,
} from '../../runtime/selection/use-canvas-selection-state'
import { isExclusivelySelectedNode } from '../../utils/canvas-selection-utils'

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
  const { editSession, selection } = useCanvasRuntime()
  const selectedNodeIds = useSelectedCanvasNodeIds()
  const isSelected = useIsCanvasNodeSelected(id)
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
      selection.replace({ nodeIds: [id], edgeIds: [] })
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
    if (!editing || !hasPendingAutoEdit || selectedNodeIds.length === 0 || isSelected) {
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
    selectedNodeIds.length,
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
