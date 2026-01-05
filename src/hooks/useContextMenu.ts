import { useCallback, useRef } from 'react'
import type { SidebarContextMenuRef as UnifiedContextMenuRef } from '~/components/context-menu/sidebar/SidebarItemContextMenu'

export function useContextMenu() {
  const contextMenuRef = useRef<UnifiedContextMenuRef>(null)

  const handleMoreOptions = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    contextMenuRef.current?.open({
      x: e.clientX,
      y: e.clientY,
    })
  }, [])

  return { contextMenuRef, handleMoreOptions }
}
