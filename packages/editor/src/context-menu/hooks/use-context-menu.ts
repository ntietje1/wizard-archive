import { useRef } from 'react'
import type { ContextMenuHostRef } from '../components/host'

export function useContextMenu() {
  const contextMenuRef = useRef<ContextMenuHostRef>(null)

  const handleMoreOptions = (e: React.MouseEvent<Element>) => {
    e.stopPropagation()
    const position =
      e.clientX !== 0 || e.clientY !== 0
        ? { x: e.clientX, y: e.clientY }
        : (() => {
            const rect = e.currentTarget.getBoundingClientRect()
            return { x: rect.left, y: rect.bottom }
          })()

    contextMenuRef.current?.open({
      x: position.x,
      y: position.y,
    })
  }

  return { contextMenuRef, handleMoreOptions }
}
