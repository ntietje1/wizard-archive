import { useEffect, useRef } from 'react'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'

interface UseDroppableOptions<
  T extends Record<string, unknown>,
  TSource extends Record<string, unknown> = Record<string, unknown>,
> {
  ref: React.RefObject<HTMLElement | null>
  data: T
  canDrop?: (sourceData: TSource) => boolean
}

export function useDroppable<
  T extends Record<string, unknown>,
  TSource extends Record<string, unknown> = Record<string, unknown>,
>({ ref, data, canDrop }: UseDroppableOptions<T, TSource>) {
  const dataRef = useRef(data)
  dataRef.current = data

  const canDropRef = useRef(canDrop)
  canDropRef.current = canDrop

  useEffect(() => {
    const el = ref.current
    if (!el) return

    return dropTargetForElements({
      element: el,
      getData: () => dataRef.current,
      canDrop: ({ source }) => canDropRef.current?.(source.data as TSource) ?? true,
    })
  }, [ref])
}
