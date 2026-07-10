import { useEffect, useRef, useState } from 'react'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'

interface UseDroppableOptions<T extends Record<string, unknown>> {
  data: T
  canDrop?: (sourceData: unknown) => boolean
}

export function useDroppable<T extends Record<string, unknown>>({
  data,
  canDrop,
}: UseDroppableOptions<T>) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const droppableRef = useRef((node: HTMLElement | null) => {
    setElement(node)
  })
  const dataRef = useRef(data)
  dataRef.current = data

  const canDropRef = useRef(canDrop)
  canDropRef.current = canDrop

  useEffect(() => {
    if (!element) return

    return dropTargetForElements({
      element,
      getData: () => dataRef.current,
      canDrop: ({ source }) => canDropRef.current?.(source.data) ?? true,
    })
  }, [element])

  return { droppableRef: droppableRef.current }
}
