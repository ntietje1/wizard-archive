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

  const postDx = target.x - pos.x
  const postDy = target.y - pos.y
  if (
    Math.abs(postDx) < settle &&
    Math.abs(postDy) < settle &&
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

  const runningRef = useRef(false)
  const rafIdRef = useRef(0)
  const startLoopRef = useRef<(() => void) | null>(null)

  targetRef.current = target

  useEffect(() => {
    const startLoop = () => {
      if (runningRef.current) return
      runningRef.current = true
      prevTimeRef.current = 0
      rafIdRef.current = requestAnimationFrame(animate)
    }

    const animate = (time: number) => {
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
        rafIdRef.current = requestAnimationFrame(animate)
        return
      }

      const dt = Math.min(
        (time - (prevTimeRef.current || time)) / 1000,
        SPRING_DEFAULTS.maxDt,
      )
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

      rafIdRef.current = requestAnimationFrame(animate)
    }

    startLoopRef.current = startLoop
    startLoop()
    return () => {
      runningRef.current = false
      cancelAnimationFrame(rafIdRef.current)
    }
  }, [elementRef])

  useEffect(() => {
    if (target) startLoopRef.current?.()
  }, [target?.x, target?.y])
}
