import { useRef, useCallback } from 'react'
import type { MouseEvent } from 'react'
import type { ContextMenuRef } from '~/components/context-menu/base/context-menu'

export function useContextMenu() {
  const contextMenuRef = useRef<ContextMenuRef>(null)

  const handleMoreOptions = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    contextMenuRef.current?.open({ x: e.clientX + 4, y: e.clientY + 4 })
  }, [])

  return { contextMenuRef, handleMoreOptions }
}
