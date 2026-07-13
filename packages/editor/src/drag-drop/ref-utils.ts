import type { RefCallback, RefObject } from 'react'

type RefTarget<T> = RefObject<T | null> | RefCallback<T> | null | undefined

export function useMergedRef<T>(
  firstRef: RefTarget<T>,
  secondRef?: RefTarget<T>,
  thirdRef?: RefTarget<T>,
  fourthRef?: RefTarget<T>,
) {
  return (node: T | null) => {
    const cleanups: Array<() => void> = []
    const refs = [firstRef, secondRef, thirdRef, fourthRef]
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') {
        const cleanup = ref(node)
        if (typeof cleanup === 'function') cleanups.push(cleanup)
      } else {
        ref.current = node
        cleanups.push(() => {
          ref.current = null
        })
      }
    }

    return cleanups.length > 0
      ? () => {
          for (const cleanup of cleanups) cleanup()
        }
      : undefined
  }
}
