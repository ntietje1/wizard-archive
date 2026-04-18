import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasInteractionStore } from './useCanvasInteractionStore'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { rectFromPoints } from '../utils/canvas-stroke-utils'
import type { Node, XYPosition } from '@xyflow/react'
import type * as Y from 'yjs'

const MIN_RECT_SIZE = 10

export function useCanvasRectangleDraw({ nodesMap }: { nodesMap: Y.Map<Node> }) {
  const startRef = useRef<XYPosition | null>(null)
  const activeRef = useRef(false)
  const lastClientPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const rafRef = useRef(0)
  const captureTargetRef = useRef<HTMLElement | null>(null)
  const pointerIdRef = useRef<number | null>(null)

  const reactFlow = useReactFlow()

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      if (captureTargetRef.current && pointerIdRef.current !== null) {
        try {
          captureTargetRef.current.releasePointerCapture(pointerIdRef.current)
        } catch {
          // Pointer capture may already be released
        }
        captureTargetRef.current = null
        pointerIdRef.current = null
      }
      activeRef.current = false
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    target.setPointerCapture(e.pointerId)
    captureTargetRef.current = target
    pointerIdRef.current = e.pointerId
    activeRef.current = true
    const pos = reactFlow.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    })
    startRef.current = pos
    lastClientPos.current = { x: e.clientX, y: e.clientY }
    useCanvasInteractionStore.getState().setSelectionRect(null)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeRef.current || e.buttons !== 1) return
    lastClientPos.current = { x: e.clientX, y: e.clientY }

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        const s = startRef.current
        if (!s) return
        const pos = reactFlow.screenToFlowPosition(lastClientPos.current)
        useCanvasInteractionStore.getState().setSelectionRect(rectFromPoints(s, pos))
      })
    }
  }

  const onPointerUp = () => {
    if (!activeRef.current) return
    activeRef.current = false

    if (captureTargetRef.current && pointerIdRef.current !== null) {
      try {
        captureTargetRef.current.releasePointerCapture(pointerIdRef.current)
      } catch {
        // Pointer capture may already be released
      }
      captureTargetRef.current = null
      pointerIdRef.current = null
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }

    const s = startRef.current
    startRef.current = null

    const pos = reactFlow.screenToFlowPosition(lastClientPos.current)
    const store = useCanvasToolStore.getState()
    useCanvasInteractionStore.getState().setSelectionRect(null)

    if (!s) return

    const rect = rectFromPoints(s, pos)
    if (rect.width < MIN_RECT_SIZE || rect.height < MIN_RECT_SIZE) return

    const id = crypto.randomUUID()
    const node: Node = {
      id,
      type: 'rectangle',
      position: { x: rect.x, y: rect.y },
      width: rect.width,
      height: rect.height,
      selected: true,
      draggable: true,
      data: { color: store.strokeColor, opacity: store.strokeOpacity },
    }

    nodesMap.set(id, node)
    store.completeActiveToolAction()
  }

  return { onPointerDown, onPointerMove, onPointerUp }
}
