import { useEffect, useRef } from 'react'
import type { CanvasHistoryController } from '../tools/canvas-tool-types'
import { useCanvasSelectionActions } from './useCanvasSelectionActions'

export function useCanvasKeyboardShortcuts({
  undo,
  redo,
}: Pick<CanvasHistoryController, 'undo' | 'redo'>) {
  const selectionActions = useCanvasSelectionActions()
  const selectionActionsRef = useRef(selectionActions)
  selectionActionsRef.current = selectionActions

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return

      const el = document.activeElement
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        selectionActionsRef.current.clearSelection()
        return
      }

      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
      } else if (key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [undo, redo])
}
