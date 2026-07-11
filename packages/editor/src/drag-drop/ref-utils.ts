import type { RefObject } from 'react'

type RefTarget<T> = RefObject<T | null> | ((node: T | null) => void) | null | undefined

export function useMergedRef<T>(...refs: Array<RefTarget<T>>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') {
        ref(node)
      } else {
        ref.current = node
      }
    }
  }
}
