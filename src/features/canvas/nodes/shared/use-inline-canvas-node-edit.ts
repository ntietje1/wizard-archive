import { useCallback, useEffect, useRef, useState } from 'react'
import { usePendingNodeEdit } from './use-pending-node-edit'

interface UseInlineCanvasNodeEditOptions<TElement extends HTMLInputElement | HTMLTextAreaElement> {
  id: string
  selected: boolean
  value: string
  onCommit: (value: string) => void
  shouldCommit: (event: React.KeyboardEvent<TElement>) => boolean
  shouldCancel: (event: React.KeyboardEvent<TElement>) => boolean
}

export function useInlineCanvasNodeEdit<TElement extends HTMLInputElement | HTMLTextAreaElement>({
  id,
  selected,
  value,
  onCommit,
  shouldCommit,
  shouldCancel,
}: UseInlineCanvasNodeEditOptions<TElement>) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const suppressBlurCommitRef = useRef(false)

  const startEditing = useCallback(() => {
    if (isEditing) return
    suppressBlurCommitRef.current = false
    setEditValue(value)
    setIsEditing(true)
  }, [isEditing, value])

  const commitEdit = useCallback(
    (nextValue: string) => {
      setIsEditing(false)
      if (nextValue !== value) {
        onCommit(nextValue)
      }
    },
    [onCommit, value],
  )

  const cancelEdit = useCallback(() => {
    suppressBlurCommitRef.current = true
    setIsEditing(false)
    setEditValue(value)
  }, [value])

  const handleBlur = useCallback(
    (event: React.FocusEvent<TElement>) => {
      if (suppressBlurCommitRef.current) {
        suppressBlurCommitRef.current = false
        return
      }

      commitEdit(event.currentTarget.value)
    },
    [commitEdit],
  )

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<TElement>) => {
      if (shouldCancel(event)) {
        event.preventDefault()
        event.stopPropagation()
        cancelEdit()
        return
      }

      if (shouldCommit(event)) {
        event.preventDefault()
        event.stopPropagation()
        suppressBlurCommitRef.current = true
        commitEdit(event.currentTarget.value)
      }
    },
    [cancelEdit, commitEdit, shouldCancel, shouldCommit],
  )

  useEffect(() => {
    if (selected || !isEditing) return

    suppressBlurCommitRef.current = false
    setIsEditing(false)
    setEditValue(value)
  }, [isEditing, selected, value])

  usePendingNodeEdit({ id, selected, isEditing, startEditing })

  return {
    isEditing,
    editValue,
    setEditValue,
    startEditing,
    cancelEdit,
    handleBlur,
    handleInputKeyDown,
  }
}
