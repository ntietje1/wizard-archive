import { useEffect, useRef } from 'react'
import { handleError } from '~/shared/utils/logger'
import { isEditableHotkeyTarget } from '~/features/sidebar/utils/item-surface-hotkeys'

type UndoRedoHandlers = {
  canUndo: boolean
  canRedo: boolean
  undo: () => Promise<unknown>
  redo: () => Promise<unknown>
}

export function isFileSystemUndoShortcut(event: KeyboardEvent) {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'z'
  )
}

export function isFileSystemRedoShortcut(event: KeyboardEvent) {
  if (event.altKey) return false
  const key = event.key.toLowerCase()
  return (
    ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'z') ||
    (event.ctrlKey && !event.metaKey && !event.shiftKey && key === 'y')
  )
}

export function useFileSystemUndoHotkeys({ canUndo, canRedo, undo, redo }: UndoRedoHandlers) {
  const isOperationInFlightRef = useRef(false)
  const handlersRef = useRef({ canUndo, canRedo, undo, redo })
  handlersRef.current = { canUndo, canRedo, undo, redo }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isOperationInFlightRef.current || isEditableHotkeyTarget(event.target)) return

      if (isFileSystemRedoShortcut(event)) {
        if (!handlersRef.current.canRedo) return
        event.preventDefault()
        isOperationInFlightRef.current = true
        void handlersRef.current
          .redo()
          .catch((error) => handleError(error, 'Filesystem redo failed'))
          .finally(() => {
            isOperationInFlightRef.current = false
          })
        return
      }

      if (isFileSystemUndoShortcut(event)) {
        if (!handlersRef.current.canUndo) return
        event.preventDefault()
        isOperationInFlightRef.current = true
        void handlersRef.current
          .undo()
          .catch((error) => handleError(error, 'Filesystem undo failed'))
          .finally(() => {
            isOperationInFlightRef.current = false
          })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
