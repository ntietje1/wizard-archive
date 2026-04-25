import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { SpringState } from '~/shared/hooks/useSpringPosition'
import { SPRING_DEFAULTS, stepSpring } from '~/shared/hooks/useSpringPosition'
import type { CanvasEngine } from '../../system/canvas-engine'

interface UseCanvasRemoteDragAnimationOptions {
  canvasEngine: CanvasEngine
  localDraggingIdsRef: React.RefObject<Set<string>>
  remoteDragPositions: Record<string, { x: number; y: number }>
}

export interface CanvasRemoteDragAnimation {
  hasSpring: (nodeId: string) => boolean
  setTarget: (nodeId: string, position: { x: number; y: number }) => void
  clearNodeSprings: (nodeIds: ReadonlySet<string>) => void
}

export function useCanvasRemoteDragAnimation({
  canvasEngine,
  localDraggingIdsRef,
  remoteDragPositions,
}: UseCanvasRemoteDragAnimationOptions): CanvasRemoteDragAnimation {
  const remoteDragRef = useRef(remoteDragPositions)
  remoteDragRef.current = remoteDragPositions
  const springStatesRef = useRef(
    new Map<string, { spring: SpringState; target: { x: number; y: number } }>(),
  )
  const prevTimeRef = useRef(0)
  const springRunningRef = useRef(false)
  const springRafIdRef = useRef(0)
  const startSpringLoopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const animate = (time: number) => {
      const dt = Math.min((time - (prevTimeRef.current || time)) / 1000, SPRING_DEFAULTS.maxDt)
      prevTimeRef.current = time

      const targets = remoteDragRef.current
      const targetKeys = Object.keys(targets)
      const springs = springStatesRef.current

      for (const nodeId of targetKeys) {
        const target = targets[nodeId]
        const existing = springs.get(nodeId)
        if (existing) {
          existing.target = target
          continue
        }
        if (localDraggingIdsRef.current?.has(nodeId)) {
          continue
        }

        springs.set(nodeId, {
          spring: {
            pos: { ...target },
            vel: { x: 0, y: 0 },
          },
          target,
        })
      }

      const updates = new Map<string, { x: number; y: number }>()
      const settled: Array<string> = []

      for (const [nodeId, springState] of springs) {
        if (localDraggingIdsRef.current?.has(nodeId)) {
          springs.delete(nodeId)
          continue
        }

        const didSettle = stepSpring(springState.spring, springState.target, dt)
        if (didSettle && !(nodeId in targets)) {
          settled.push(nodeId)
        }

        updates.set(nodeId, {
          x: springState.spring.pos.x,
          y: springState.spring.pos.y,
        })
      }

      for (const nodeId of settled) {
        springs.delete(nodeId)
      }

      if (updates.size > 0) {
        canvasEngine.updateDrag(updates)
      }

      if (springs.size === 0) {
        springRunningRef.current = false
        springRafIdRef.current = 0
        return
      }

      springRafIdRef.current = requestAnimationFrame(animate)
    }

    startSpringLoopRef.current = () => {
      if (springRunningRef.current) return
      springRunningRef.current = true
      prevTimeRef.current = 0
      springRafIdRef.current = requestAnimationFrame(animate)
    }

    return () => {
      springRunningRef.current = false
      cancelAnimationFrame(springRafIdRef.current)
      springRafIdRef.current = 0
    }
  }, [canvasEngine, localDraggingIdsRef])

  useEffect(() => {
    if (Object.keys(remoteDragPositions).length > 0) {
      startSpringLoopRef.current?.()
    }
  }, [remoteDragPositions])

  const hasSpring = useCallback((nodeId: string) => springStatesRef.current.has(nodeId), [])

  const setTarget = useCallback((nodeId: string, position: { x: number; y: number }) => {
    const existing = springStatesRef.current.get(nodeId)
    if (existing) {
      existing.target = position
      startSpringLoopRef.current?.()
      return
    }

    springStatesRef.current.set(nodeId, {
      spring: {
        pos: { ...position },
        vel: { x: 0, y: 0 },
      },
      target: position,
    })
    startSpringLoopRef.current?.()
  }, [])

  const clearNodeSprings = useCallback((nodeIds: ReadonlySet<string>) => {
    for (const nodeId of nodeIds) {
      springStatesRef.current.delete(nodeId)
    }
    if (springStatesRef.current.size === 0) {
      springRunningRef.current = false
      cancelAnimationFrame(springRafIdRef.current)
      springRafIdRef.current = 0
    }
  }, [])

  return useMemo(
    () => ({
      hasSpring,
      setTarget,
      clearNodeSprings,
    }),
    [clearNodeSprings, hasSpring, setTarget],
  )
}
