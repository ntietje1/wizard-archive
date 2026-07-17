import { useLayoutEffect, useRef } from 'react'
import { stepSpringPosition } from './spring-position'
import type { MutableSpringState, SpringPosition } from './spring-position'

export function useSpringPosition(
  target: SpringPosition,
  elementRef: React.RefObject<HTMLElement | null>,
) {
  const state = useRef<MutableSpringState | null>(null)
  const targetX = target.x
  const targetY = target.y

  useLayoutEffect(() => {
    if (!state.current) {
      state.current = {
        position: { x: targetX, y: targetY },
        velocity: { x: 0, y: 0 },
      }
      setElementPosition(elementRef.current, { x: targetX, y: targetY })
    }
    const destination = { x: targetX, y: targetY }
    let previousTime = performance.now()
    let frame = 0
    const animate = (time: number) => {
      const current = state.current
      if (!current) return
      const elapsed = (time - previousTime) / 1000
      previousTime = time
      const settled = stepSpringPosition(current, destination, elapsed)
      setElementPosition(elementRef.current, current.position)
      if (!settled) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [elementRef, targetX, targetY])
}

function setElementPosition(element: HTMLElement | null, position: SpringPosition) {
  if (element) element.style.transform = `translate(${position.x}px, ${position.y}px)`
}
