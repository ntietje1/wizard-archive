import { useEffect, useRef, useState } from 'react'
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview'

interface UseDraggableOptions<T extends Record<string, unknown>> {
  data: T
  canDrag: boolean
}

export function useDraggable<T extends Record<string, unknown>>({
  data,
  canDrag,
}: UseDraggableOptions<T>) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const isDraggingRef = useRef(false)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    if (!element || !canDrag) return

    const resetDragging = () => {
      isDraggingRef.current = false
      element.removeAttribute('data-item-dragging')
    }
    const cleanup = draggable({
      element,
      getInitialData: () => dataRef.current,
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        disableNativeDragPreview({ nativeSetDragImage })
      },
      onDragStart: () => {
        isDraggingRef.current = true
        element.setAttribute('data-item-dragging', '')
      },
      onDrop: () => {
        resetDragging()
      },
    })

    return () => {
      cleanup()
      resetDragging()
    }
  }, [element, canDrag])

  return { draggableRef: setElement, isDraggingRef }
}
