import { useRef, useState } from 'react'

interface UseNodeEditingOptions {
  id: string
  currentValue: string
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
}

export function useNodeEditing({ id, currentValue, updateNodeData }: UseNodeEditingOptions) {
  const [isEditing, setIsEditing] = useState(false)
  const shouldCommitRef = useRef(true)

  const startEditing = () => {
    shouldCommitRef.current = true
    setIsEditing(true)
  }

  const commitEdit = (value: string) => {
    setIsEditing(false)
    if (value !== currentValue) updateNodeData(id, { label: value })
  }

  const handleBlur = (value: string) => {
    if (shouldCommitRef.current) commitEdit(value)
    else setIsEditing(false)
    shouldCommitRef.current = true
  }

  const handleKeyDown = (e: React.KeyboardEvent, value: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      shouldCommitRef.current = false
      commitEdit(value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      shouldCommitRef.current = false
      setIsEditing(false)
    }
  }

  const containerKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === 'F2') && !isEditing) {
      e.preventDefault()
      e.stopPropagation()
      startEditing()
    }
  }

  return {
    isEditing,
    startEditing,
    handleBlur,
    handleKeyDown,
    containerKeyDown,
  }
}
