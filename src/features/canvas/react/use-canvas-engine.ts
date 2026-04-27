import { useCallback, useRef, useSyncExternalStore } from 'react'
import { useCanvasEngine } from './canvas-engine-context-value'
import type { CanvasEngineEquality, CanvasEngineSnapshot } from '../system/canvas-engine'

export { useCanvasEngine }

export function useCanvasEngineSelector<T>(
  selector: (snapshot: CanvasEngineSnapshot) => T,
  equality: CanvasEngineEquality<T> = Object.is,
): T {
  const engine = useCanvasEngine()
  const selectorRef = useRef(selector)
  const equalityRef = useRef(equality)
  const selectedRef = useRef(selector(engine.getSnapshot()))
  selectorRef.current = selector
  equalityRef.current = equality
  const currentSelected = selector(engine.getSnapshot())
  if (!equality(selectedRef.current, currentSelected)) {
    selectedRef.current = currentSelected
  }
  const subscribe = useCallback(
    (notify: () => void) =>
      engine.subscribe(() => {
        const next = selectorRef.current(engine.getSnapshot())
        if (equalityRef.current(selectedRef.current, next)) {
          return
        }

        selectedRef.current = next
        notify()
      }),
    [engine],
  )
  const getSnapshot = useCallback(() => selectedRef.current, [])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useCanvasViewportZoom(): number {
  const engine = useCanvasEngine()
  return useSyncExternalStore(
    engine.subscribeViewportChange,
    () => engine.getSnapshot().viewport.zoom,
    () => engine.getSnapshot().viewport.zoom,
  )
}
