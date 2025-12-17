import { useRef, useCallback } from 'react'
import type { MouseEvent } from 'react'
import type { ContextMenuRef } from '~/components/context-menu/base/context-menu'

export function useContextMenu() {
  const contextMenuRef = useRef<ContextMenuRef>(null)

  const handleMoreOptions = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    contextMenuRef.current?.open(e)
  }, [])

  return { contextMenuRef, handleMoreOptions }
}
