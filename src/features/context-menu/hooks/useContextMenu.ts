import { useCallback, useRef } from 'react'
import type { EditorContextMenuRef } from '~/features/context-menu/components/EditorContextMenu'

export function useContextMenu() {
  const contextMenuRef = useRef<EditorContextMenuRef>(null)

  const handleMoreOptions = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    contextMenuRef.current?.open({
      x: e.clientX,
      y: e.clientY,
    })
  }, [])

  return { contextMenuRef, handleMoreOptions }
}
