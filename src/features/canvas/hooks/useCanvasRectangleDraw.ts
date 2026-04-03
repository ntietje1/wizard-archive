import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { rectFromPoints } from '../utils/canvas-stroke-utils'
import type { Node, XYPosition } from '@xyflow/react'
import type * as Y from 'yjs'

const MIN_RECT_SIZE = 10

export function useCanvasRectangleDraw({
  nodesMap,
}: {
  nodesMap: Y.Map<Node>
}) {
  const startRef = useRef<XYPosition | null>(null)
  const activeRef = useRef(false)
  const lastClientPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const rafRef = useRef(0)

  const reactFlow = useReactFlow()

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      activeRef.current = true
      const pos = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      startRef.current = pos
      lastClientPos.current = { x: e.clientX, y: e.clientY }
      useCanvasToolStore.getState().setSelectionRect(null)
    },
    [reactFlow],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeRef.current || e.buttons !== 1) return
      lastClientPos.current = { x: e.clientX, y: e.clientY }

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0
          const s = startRef.current
          if (!s) return
          const pos = reactFlow.screenToFlowPosition(lastClientPos.current)
          useCanvasToolStore.getState().setSelectionRect(rectFromPoints(s, pos))
        })
      }
    },
    [reactFlow],
  )

  const onPointerUp = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }

    const s = startRef.current
    startRef.current = null

    const pos = reactFlow.screenToFlowPosition(lastClientPos.current)
    const store = useCanvasToolStore.getState()
    store.setSelectionRect(null)

    if (!s) return

    const rect = rectFromPoints(s, pos)
    if (rect.width < MIN_RECT_SIZE && rect.height < MIN_RECT_SIZE) return

    const id = crypto.randomUUID()
    const node: Node = {
      id,
      type: 'rectangle',
      position: { x: rect.x, y: rect.y },
      width: rect.width,
      height: rect.height,
      data: { color: store.strokeColor, opacity: store.strokeOpacity },
    }

    nodesMap.set(id, node)
  }, [reactFlow, nodesMap])

  return { onPointerDown, onPointerMove, onPointerUp }
}
