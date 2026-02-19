import { useEffect, useRef } from 'react'
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview'

interface UseDraggableOptions<T extends Record<string, unknown>> {
  ref: React.RefObject<HTMLElement | null>
  data: T
  canDrag: boolean
  dragOpacity?: string
}

export function useDraggable<T extends Record<string, unknown>>({
  ref,
  data,
  canDrag,
  dragOpacity = '0.5',
}: UseDraggableOptions<T>) {
  const isDraggingRef = useRef(false)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    const el = ref.current
    if (!el || !canDrag) return

    return draggable({
      element: el,
      getInitialData: () => dataRef.current,
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        disableNativeDragPreview({ nativeSetDragImage })
      },
      onDragStart: () => {
        isDraggingRef.current = true
        el.style.opacity = dragOpacity
        el.setAttribute('data-item-dragging', '')
      },
      onDrop: () => {
        isDraggingRef.current = false
        el.style.opacity = ''
        el.removeAttribute('data-item-dragging')
      },
    })
    // Re-register only when identity or permission changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, canDrag])

  return { isDraggingRef }
}
