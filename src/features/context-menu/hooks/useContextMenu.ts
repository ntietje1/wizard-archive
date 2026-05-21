import { useRef } from 'react'
import type { ContextMenuHostRef } from '~/features/context-menu/components/context-menu-host'

export function useContextMenu() {
  const contextMenuRef = useRef<ContextMenuHostRef>(null)

  const handleMoreOptions = (e: React.MouseEvent) => {
    e.stopPropagation()
    contextMenuRef.current?.open({
      x: e.clientX,
      y: e.clientY,
    })
  }

  return { contextMenuRef, handleMoreOptions }
}
