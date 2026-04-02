import { useEffect, useRef } from 'react'

export type Vec2 = { x: number; y: number }

export type SpringOptions = {
  stiffness?: number
  damping?: number
  settleThreshold?: number
}

export const SPRING_DEFAULTS = {
  stiffness: 600,
  damping: 50,
  settleThreshold: 0.3,
  maxDt: 0.04,
} as const

export type SpringState = { pos: Vec2; vel: Vec2 }

export function stepSpring(
  state: SpringState,
  target: Vec2,
  dt: number,
  opts?: SpringOptions,
): boolean {
  const stiffness = opts?.stiffness ?? SPRING_DEFAULTS.stiffness
  const damping = opts?.damping ?? SPRING_DEFAULTS.damping
  const settle = opts?.settleThreshold ?? SPRING_DEFAULTS.settleThreshold

  const { pos, vel } = state
  const dx = target.x - pos.x
  const dy = target.y - pos.y

  vel.x += (stiffness * dx - damping * vel.x) * dt
  vel.y += (stiffness * dy - damping * vel.y) * dt
  pos.x += vel.x * dt
  pos.y += vel.y * dt

  if (
    Math.abs(dx) < settle &&
    Math.abs(dy) < settle &&
    Math.abs(vel.x) < settle &&
    Math.abs(vel.y) < settle
  ) {
    pos.x = target.x
    pos.y = target.y
    vel.x = 0
    vel.y = 0
    return true
  }

  return false
}

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

  targetRef.current = target

  useEffect(() => {
    let rafId: number

    const animate = (time: number) => {
      const t = targetRef.current
      if (!t) {
        posRef.current = null
        velRef.current = { x: 0, y: 0 }
        prevTimeRef.current = 0
        rafId = requestAnimationFrame(animate)
        return
      }

      if (!posRef.current) {
        posRef.current = { ...t }
        prevTimeRef.current = time
        if (elementRef.current) {
          elementRef.current.style.transform = `translate(${t.x}px, ${t.y}px)`
        }
        rafId = requestAnimationFrame(animate)
        return
      }

      const dt = Math.min(
        (time - (prevTimeRef.current || time)) / 1000,
        SPRING_DEFAULTS.maxDt,
      )
      prevTimeRef.current = time

      const state: SpringState = { pos: posRef.current, vel: velRef.current }
      stepSpring(state, t, dt, optionsRef.current)

      if (elementRef.current) {
        elementRef.current.style.transform = `translate(${state.pos.x}px, ${state.pos.y}px)`
      }

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [elementRef])
}
