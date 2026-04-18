import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasInteractionStore } from './useCanvasInteractionStore'
import { polylineIntersectsStroke } from '../utils/canvas-stroke-utils'
import type { StrokeNodeData } from '../components/nodes/stroke-node'
import type { Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasEraserOptions {
  nodesMap: Y.Map<Node>
}

export function useCanvasEraser({ nodesMap }: UseCanvasEraserOptions) {
  const trailRef = useRef<Array<{ x: number; y: number }>>([])
  const erasingRef = useRef(false)
  const markedRef = useRef(new Set<string>())
  const eraserRafRef = useRef(0)
  const reactFlow = useReactFlow()

  const testIntersections = () => {
    const trail = trailRef.current
    if (trail.length < 2) return

    const strokeNodes = reactFlow.getNodes().filter((n) => n.type === 'stroke')

    let changed = false
    for (const node of strokeNodes) {
      if (markedRef.current.has(node.id)) continue

      const data = node.data as StrokeNodeData
      if (!data?.bounds) continue

      const offsetX = node.position.x - data.bounds.x
      const offsetY = node.position.y - data.bounds.y

      const adjustedStroke = {
        id: node.id,
        color: data.color,
        size: data.size,
        points: data.points.map(
          ([x, y, p]) => [x + offsetX, y + offsetY, p] as [number, number, number],
        ),
      }

      if (polylineIntersectsStroke(trail, adjustedStroke)) {
        markedRef.current.add(node.id)
        changed = true
      }
    }
    if (changed) {
      useCanvasInteractionStore.getState().setErasingStrokeIds(new Set(markedRef.current))
    }
  }

  const pointerIdRef = useRef<number | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    pointerIdRef.current = e.pointerId
    erasingRef.current = true
    markedRef.current = new Set()
    const pos = reactFlow.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    })
    trailRef.current = [pos]
    useCanvasInteractionStore.getState().setErasingStrokeIds(new Set())
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!erasingRef.current || e.buttons !== 1) return
    const pos = reactFlow.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    })
    trailRef.current.push(pos)
    if (trailRef.current.length > 300) {
      trailRef.current = trailRef.current.slice(-200)
    }
    if (!eraserRafRef.current) {
      eraserRafRef.current = requestAnimationFrame(() => {
        eraserRafRef.current = 0
        testIntersections()
      })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== null) {
      try {
        ;(e.currentTarget as Element).releasePointerCapture(pointerIdRef.current)
      } catch {
        /* already released */
      }
      pointerIdRef.current = null
    }
    erasingRef.current = false
    if (eraserRafRef.current) {
      cancelAnimationFrame(eraserRafRef.current)
      eraserRafRef.current = 0
    }
    testIntersections()
    const marked = markedRef.current
    if (marked.size > 0) {
      if (nodesMap.doc) {
        nodesMap.doc.transact(() => {
          for (const id of marked) {
            nodesMap.delete(id)
          }
        })
      } else {
        for (const id of marked) {
          nodesMap.delete(id)
        }
      }
    }
    markedRef.current = new Set()
    trailRef.current = []
    useCanvasInteractionStore.getState().setErasingStrokeIds(new Set())
  }

  useEffect(() => {
    return () => {
      if (eraserRafRef.current) {
        cancelAnimationFrame(eraserRafRef.current)
      }
      useCanvasInteractionStore.getState().setErasingStrokeIds(new Set())
    }
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp }
}
