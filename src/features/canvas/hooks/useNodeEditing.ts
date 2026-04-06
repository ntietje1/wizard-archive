import { useCallback, useRef, useState } from 'react'

interface UseNodeEditingOptions {
  id: string
  currentValue: string
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
}

export function useNodeEditing({
  id,
  currentValue,
  updateNodeData,
}: UseNodeEditingOptions) {
  const [isEditing, setIsEditing] = useState(false)
  const shouldCommitRef = useRef(true)

  const startEditing = useCallback(() => {
    shouldCommitRef.current = true
    setIsEditing(true)
  }, [])

  const commitEdit = useCallback(
    (value: string) => {
      setIsEditing(false)
      if (value !== currentValue) updateNodeData(id, { label: value })
    },
    [id, currentValue, updateNodeData],
  )

  const handleBlur = useCallback(
    (value: string) => {
      if (shouldCommitRef.current) commitEdit(value)
      else setIsEditing(false)
      shouldCommitRef.current = true
    },
    [commitEdit],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, value: string) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        shouldCommitRef.current = false
        commitEdit(value)
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        shouldCommitRef.current = false
        setIsEditing(false)
      }
    },
    [commitEdit],
  )

  const containerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === 'F2') && !isEditing) {
        e.preventDefault()
        startEditing()
      }
    },
    [isEditing, startEditing],
  )

  return {
    isEditing,
    startEditing,
    handleBlur,
    handleKeyDown,
    containerKeyDown,
  }
}
