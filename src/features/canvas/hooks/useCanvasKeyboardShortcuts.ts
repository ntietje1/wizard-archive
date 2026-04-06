import { useEffect } from 'react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'

export function useCanvasKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      const el = document.activeElement
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return
      }

      const { undo, redo } = useCanvasToolStore.getState()
      const code = e.code
      const key = e.key.toLowerCase()
      if ((code === 'KeyZ' || key === 'z') && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((code === 'KeyZ' || key === 'z') && e.shiftKey) {
        e.preventDefault()
        redo()
      } else if (code === 'KeyY' || key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}
