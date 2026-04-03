import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { polylineIntersectsStroke } from '../components/viewer/canvas/canvas-stroke-utils'
import type { StrokeNodeData } from '../components/viewer/canvas/nodes/stroke-node'
import type { Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasEraserOptions {
  nodesMap: Y.Map<Node>
}

export function useCanvasEraser({ nodesMap }: UseCanvasEraserOptions) {
  const trailRef = useRef<Array<{ x: number; y: number }>>([])
  const erasingRef = useRef(false)
  const markedRef = useRef(new Set<string>())
  const reactFlow = useReactFlow()

  const testIntersections = useCallback(() => {
    const trail = trailRef.current
    if (trail.length < 2) return

    const strokeNodes = reactFlow.getNodes().filter((n) => n.type === 'stroke')

    let changed = false
    for (const node of strokeNodes) {
      if (markedRef.current.has(node.id)) continue

      const data = node.data as StrokeNodeData
      const offsetX = node.position.x - data.bounds.x
      const offsetY = node.position.y - data.bounds.y

      const adjustedStroke = {
        id: node.id,
        color: data.color,
        size: data.size,
        points: data.points.map(
          ([x, y, p]) =>
            [x + offsetX, y + offsetY, p] as [number, number, number],
        ),
      }

      if (polylineIntersectsStroke(trail, adjustedStroke)) {
        markedRef.current.add(node.id)
        changed = true
      }
    }
    if (changed) {
      useCanvasToolStore
        .getState()
        .setErasingStrokeIds(new Set(markedRef.current))
    }
  }, [reactFlow])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      erasingRef.current = true
      markedRef.current = new Set()
      const pos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      trailRef.current = [pos]
      useCanvasToolStore.getState().setErasingStrokeIds(new Set())
    },
    [reactFlow],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!erasingRef.current || e.buttons !== 1) return
      const pos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      trailRef.current.push(pos)
      testIntersections()
    },
    [reactFlow, testIntersections],
  )

  const onPointerUp = useCallback(() => {
    erasingRef.current = false
    for (const id of markedRef.current) {
      nodesMap.delete(id)
    }
    markedRef.current = new Set()
    trailRef.current = []
    useCanvasToolStore.getState().setErasingStrokeIds(new Set())
  }, [nodesMap])

  return { onPointerDown, onPointerMove, onPointerUp }
}
