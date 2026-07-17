import { useEffect, useLayoutEffect, useRef } from 'react'
import { stepSpringPosition } from './spring-position'
import type { MutableSpringState, SpringPosition } from './spring-position'

export function useSpringPosition(
  target: SpringPosition,
  elementRef: React.RefObject<HTMLElement | null>,
) {
  const state = useRef<MutableSpringState | null>(null)
  const targetRef = useRef(target)
  const previousTime = useRef(0)
  const frame = useRef(0)
  const running = useRef(false)
  const animate = useRef<(time: number) => void>(() => undefined)
  const targetX = target.x
  const targetY = target.y
  targetRef.current = target

  animate.current = (time) => {
    const current = state.current
    if (!current) return
    const elapsed = (time - (previousTime.current || time)) / 1000
    previousTime.current = time
    const settled = stepSpringPosition(current, targetRef.current, elapsed)
    setElementPosition(elementRef.current, current.position)
    if (settled) {
      running.current = false
      return
    }
    frame.current = requestAnimationFrame(animate.current)
  }

  useLayoutEffect(() => {
    if (!state.current) {
      state.current = {
        position: { x: targetX, y: targetY },
        velocity: { x: 0, y: 0 },
      }
      setElementPosition(elementRef.current, { x: targetX, y: targetY })
    }
    if (running.current) return
    running.current = true
    previousTime.current = performance.now()
    frame.current = requestAnimationFrame(animate.current)
  }, [elementRef, targetX, targetY])

  useEffect(
    () => () => {
      running.current = false
      cancelAnimationFrame(frame.current)
    },
    [],
  )
}

function setElementPosition(element: HTMLElement | null, position: SpringPosition) {
  if (element) element.style.transform = `translate(${position.x}px, ${position.y}px)`
}
