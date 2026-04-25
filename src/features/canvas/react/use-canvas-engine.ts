import { useContext, useEffect, useState } from 'react'
import { CanvasEngineContext } from './canvas-engine-context-value'
import type {
  CanvasEngine,
  CanvasEngineEquality,
  CanvasEngineSnapshot,
} from '../system/canvas-engine'

export function useCanvasEngine(): CanvasEngine {
  const engine = useContext(CanvasEngineContext)
  if (!engine) {
    throw new Error('useCanvasEngine must be used within CanvasEngineProvider')
  }

  return engine
}

export function useCanvasEngineSelector<T>(
  selector: (snapshot: CanvasEngineSnapshot) => T,
  equality: CanvasEngineEquality<T> = Object.is,
): T {
  const engine = useCanvasEngine()
  const [selected, setSelected] = useState(() => selector(engine.getSnapshot()))

  useEffect(() => {
    setSelected((current) => {
      const next = selector(engine.getSnapshot())
      return equality(current, next) ? current : next
    })
    return engine.subscribeSelector(
      selector,
      (next) => {
        setSelected(next)
      },
      equality,
    )
  }, [engine, equality, selector])

  return selected
}
