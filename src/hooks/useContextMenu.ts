import { useRef, useCallback } from 'react'
import type { SidebarItemContextMenuRef as UnifiedContextMenuRef } from '~/components/context-menu/sidebar/SidebarItemContextMenu'

export function useContextMenu() {
  const contextMenuRef = useRef<UnifiedContextMenuRef>(null)

  const handleMoreOptions = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    contextMenuRef.current?.open({ x: e.clientX + 4, y: e.clientY + 4 })
  }, [])

  return { contextMenuRef, handleMoreOptions }
}
