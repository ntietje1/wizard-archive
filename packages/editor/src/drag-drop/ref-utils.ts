import { useRef } from 'react'
import type { RefObject } from 'react'

type RefTarget<T> = RefObject<T | null> | ((node: T | null) => void) | null | undefined

export function useMergedRef<T>(...refs: Array<RefTarget<T>>) {
  const refsRef = useRef(refs)
  refsRef.current = refs

  const mergedRef = useRef((node: T | null) => {
    for (const ref of refsRef.current) {
      if (!ref) continue
      if (typeof ref === 'function') {
        ref(node)
      } else {
        ref.current = node
      }
    }
  })

  return mergedRef.current
}
