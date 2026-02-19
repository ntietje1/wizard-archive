import { useEffect, useRef } from 'react'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { SidebarDragData, SidebarDropData } from '~/lib/dnd-utils'
import { validateDrop } from '~/lib/dnd-utils'

interface UseDroppableOptions<T extends SidebarDropData> {
  ref: React.RefObject<HTMLElement | null>
  data: T
}

export function useDroppable<T extends SidebarDropData>({
  ref,
  data,
}: UseDroppableOptions<T>) {
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    const el = ref.current
    if (!el) return

    return dropTargetForElements({
      element: el,
      getData: () => dataRef.current,
      canDrop: ({ source }) => {
        const dragData = source.data as SidebarDragData
        return validateDrop(dragData, dataRef.current).valid
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])
}
