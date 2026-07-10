import { useLayoutEffect, useRef } from 'react'

export function useScrollSelectedItemIntoView<TElement extends HTMLElement>(
  selectedItemKey: unknown,
) {
  const selectedItemRef = useRef<TElement | null>(null)

  useLayoutEffect(() => {
    const selectedItem = selectedItemRef.current
    if (typeof selectedItem?.scrollIntoView !== 'function') return
    selectedItem.scrollIntoView({ block: 'nearest' })
  }, [selectedItemKey])

  return selectedItemRef
}
