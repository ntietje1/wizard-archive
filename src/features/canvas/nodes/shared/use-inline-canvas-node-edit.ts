import { useEffect, useRef, useState } from 'react'
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

  const startEditing = () => {
    if (isEditing) return
    suppressBlurCommitRef.current = false
    setEditValue(value)
    setIsEditing(true)
  }

  const commitEdit = (nextValue: string) => {
    setIsEditing(false)
    if (nextValue !== value) {
      onCommit(nextValue)
    }
  }

  const cancelEdit = () => {
    suppressBlurCommitRef.current = true
    setIsEditing(false)
    setEditValue(value)
  }

  const handleBlur = (event: React.FocusEvent<TElement>) => {
    if (suppressBlurCommitRef.current) {
      suppressBlurCommitRef.current = false
      return
    }

    commitEdit(event.currentTarget.value)
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<TElement>) => {
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
  }

  useEffect(() => {
    if (selected || !isEditing) return

    suppressBlurCommitRef.current = true
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
