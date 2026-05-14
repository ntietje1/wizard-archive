import { useEffect, useRef } from 'react'
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview'

interface UseDraggableOptions<T extends Record<string, unknown>> {
  ref: React.RefObject<HTMLElement | null>
  data: T
  canDrag: boolean
}

export function useDraggable<T extends Record<string, unknown>>({
  ref,
  data,
  canDrag,
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
        el.setAttribute('data-item-dragging', '')
      },
      onDrop: () => {
        isDraggingRef.current = false
        el.removeAttribute('data-item-dragging')
      },
    })
  }, [ref, canDrag])

  return { isDraggingRef }
}
