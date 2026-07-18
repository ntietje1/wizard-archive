import { useEffect, useRef } from 'react'
import type { DragEvent } from 'react'
import type { AuthoredDestinationDropResolver } from '../resources/authored-destination-drop'
import type { CanvasDocumentController } from './document-controller'
import type { CanvasInteractionController } from './interaction-controller'
import { screenToCanvasPoint } from './canvas-viewport'
import { CANVAS_WORKLOAD_LIMITS } from './workload'
import { DOMAIN_ID_KIND, generateDomainId } from '../resources/domain-id'

const EMBED_SIZE = { width: 320, height: 240 }
const STACK_OFFSET = 20

function clearCanvasDropTarget(event: DragEvent<HTMLElement>) {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
  delete event.currentTarget.dataset.dropTarget
}

export function useCanvasDropTarget({
  canEdit,
  documentController,
  drop,
  interactionController,
}: {
  canEdit: boolean
  documentController: CanvasDocumentController
  drop: AuthoredDestinationDropResolver | null
  interactionController: CanvasInteractionController
}) {
  const lifetime = useRef<AbortController | null>(null)
  const consumedDrops = useRef(new WeakSet<DataTransfer>())

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => {
      controller.abort()
      if (lifetime.current === controller) lifetime.current = null
    }
  }, [])

  const canResolve = (dataTransfer: Pick<DataTransfer, 'types'>) =>
    canEdit && drop?.canResolve(dataTransfer) === true

  const mark = (event: DragEvent<HTMLElement>) => {
    if (!canResolve(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    event.currentTarget.dataset.dropTarget = 'true'
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    clearCanvasDropTarget(event)
    if (!drop || !canResolve(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    if (consumedDrops.current.has(event.dataTransfer)) return
    consumedDrops.current.add(event.dataTransfer)
    const bounds = event.currentTarget.getBoundingClientRect()
    const point = screenToCanvasPoint(
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      interactionController.get().viewport,
    )
    const maximumDestinations = Math.min(
      CANVAS_WORKLOAD_LIMITS.nodes - documentController.read().nodes.length,
      CANVAS_WORKLOAD_LIMITS.selectedElements,
    )
    const signal = lifetime.current?.signal
    if (maximumDestinations <= 0 || !signal) return
    void drop.resolve(event.dataTransfer, maximumDestinations, signal).then((destinations) => {
      if (signal.aborted) return
      const available = Math.max(
        0,
        CANVAS_WORKLOAD_LIMITS.nodes - documentController.read().nodes.length,
      )
      const nodes = destinations.slice(0, available).map((destination, index) => ({
        id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
        type: 'embed' as const,
        position: {
          x: point.x + index * STACK_OFFSET,
          y: point.y + index * STACK_OFFSET,
        },
        ...EMBED_SIZE,
        data: { destination },
      }))
      if (nodes.length === 0) return
      documentController.apply({ type: 'insert', nodes, edges: [] })
      interactionController.setSelection({
        nodeIds: new Set(nodes.map((node) => node.id)),
        edgeIds: new Set(),
      })
    })
  }

  return {
    onDragEnter: mark,
    onDragOver: mark,
    onDragLeave: clearCanvasDropTarget,
    onDrop,
  }
}
