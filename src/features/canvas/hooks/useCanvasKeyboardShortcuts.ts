import { useReactFlow } from '@xyflow/react'
import { useEffect } from 'react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'

export function useCanvasKeyboardShortcuts() {
  const reactFlow = useReactFlow()

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
        reactFlow.setNodes((nodes) =>
          nodes.map((node) =>
            node.selected ? { ...node, selected: false } : node,
          ),
        )
        reactFlow.setEdges((edges) =>
          edges.map((edge) =>
            edge.selected ? { ...edge, selected: false } : edge,
          ),
        )
        return
      }

      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      const { undo, redo } = useCanvasToolStore.getState()
      const code = e.code
      if (code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (code === 'KeyZ' && e.shiftKey) {
        e.preventDefault()
        redo()
      } else if (code === 'KeyY') {
        e.preventDefault()
        redo()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [reactFlow])
}
