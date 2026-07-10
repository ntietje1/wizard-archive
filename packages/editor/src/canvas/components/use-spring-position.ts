import { useEffect, useLayoutEffect, useRef } from 'react'
import { stepSpring } from './spring-position'
import type { SpringOptions, SpringState, Vec2 } from './spring-position'

export function useSpringPosition(
  target: Vec2 | null,
  elementRef: React.RefObject<HTMLElement | null>,
  options?: SpringOptions,
) {
  const posRef = useRef<Vec2 | null>(null)
  const velRef = useRef<Vec2>({ x: 0, y: 0 })
  const targetRef = useRef<Vec2 | null>(null)
  const prevTimeRef = useRef(0)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const runningRef = useRef(false)
  const rafIdRef = useRef(0)
  const animateRef = useRef<(time: number) => void>(() => undefined)

  targetRef.current = target

  animateRef.current = (time: number) => {
    const t = targetRef.current
    if (!t) {
      posRef.current = null
      velRef.current = { x: 0, y: 0 }
      prevTimeRef.current = 0
      runningRef.current = false
      return
    }

    if (!posRef.current) {
      posRef.current = { ...t }
      prevTimeRef.current = time
      if (elementRef.current) {
        elementRef.current.style.transform = `translate(${t.x}px, ${t.y}px)`
      }
      rafIdRef.current = requestAnimationFrame(animateRef.current)
      return
    }

    const dt = (time - (prevTimeRef.current || time)) / 1000
    prevTimeRef.current = time

    const state: SpringState = { pos: posRef.current, vel: velRef.current }
    const settled = stepSpring(state, t, dt, optionsRef.current)

    if (elementRef.current) {
      elementRef.current.style.transform = `translate(${state.pos.x}px, ${state.pos.y}px)`
    }

    if (settled) {
      runningRef.current = false
      return
    }

    rafIdRef.current = requestAnimationFrame(animateRef.current)
  }

  useEffect(() => {
    return () => {
      runningRef.current = false
      cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  useLayoutEffect(() => {
    if (!target) {
      runningRef.current = false
      cancelAnimationFrame(rafIdRef.current)
      posRef.current = null
      velRef.current = { x: 0, y: 0 }
      prevTimeRef.current = 0
      if (elementRef.current) {
        elementRef.current.style.transform = ''
      }
      return
    }

    if (!posRef.current) {
      posRef.current = { ...target }
      velRef.current = { x: 0, y: 0 }
      prevTimeRef.current = 0
      if (elementRef.current) {
        elementRef.current.style.transform = `translate(${target.x}px, ${target.y}px)`
      }
    }
    if (!runningRef.current) {
      runningRef.current = true
      prevTimeRef.current = performance.now()
      rafIdRef.current = requestAnimationFrame(animateRef.current)
    }
  }, [elementRef, target])
}
