import { useEffect, useRef } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { createEmbedCanvasNode } from '../components/nodes/embed-node-creation'
import type { Id } from 'convex/_generated/dataModel'
import type { Node } from '@xyflow/react'
import type { CanvasDropZoneData } from '~/features/dnd/utils/dnd-registry'
import type { FileDropOverride } from '~/features/dnd/stores/dnd-store'
import { handleError } from '~/shared/utils/logger'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useFileDropHandler } from '~/features/dnd/hooks/useFileDropHandler'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { CANVAS_DROP_ZONE_TYPE, getDragItemId } from '~/features/dnd/utils/dnd-registry'

const STACK_OFFSET = 20

interface UseCanvasDropTargetOptions {
  canvasId: Id<'sidebarItems'>
  enabled: boolean
  createNode: (node: Node) => void
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }
}

export function useCanvasDropTarget({
  canvasId,
  enabled,
  createNode,
  screenToFlowPosition,
}: UseCanvasDropTargetOptions) {
  const dropOverlayRef = useRef<HTMLDivElement>(null)

  const dropData: CanvasDropZoneData = {
    type: CANVAS_DROP_ZONE_TYPE,
    canvasId,
  }
  const { isDropTarget } = useDndDropTarget({
    ref: dropOverlayRef,
    data: dropData,
    highlightId: `canvas:${canvasId}`,
  })

  const { isFileDropTarget } = useExternalDropTarget({
    ref: dropOverlayRef,
    parentId: null,
    canAcceptFiles: enabled,
  })

  const canvasIdRef = useRef(canvasId)
  canvasIdRef.current = canvasId
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const createNodeRef = useRef(createNode)
  createNodeRef.current = createNode
  const screenToFlowPositionRef = useRef(screenToFlowPosition)
  screenToFlowPositionRef.current = screenToFlowPosition

  useEffect(() => {
    return monitorForElements({
      onDrop: ({ source, location }) => {
        if (!enabledRef.current) return
        const topTarget = location.current.dropTargets[0]
        if (!topTarget) return

        const targetData = topTarget.data
        if (targetData.type !== CANVAS_DROP_ZONE_TYPE) return
        if (targetData.canvasId !== canvasIdRef.current) return

        const sidebarItemId = getDragItemId(source.data)
        if (!sidebarItemId) return
        if ((sidebarItemId as string) === (canvasIdRef.current as string)) return

        const { clientX, clientY } = location.current.input
        const position = screenToFlowPositionRef.current({
          x: clientX,
          y: clientY,
        })

        createNodeRef.current(createEmbedCanvasNode(sidebarItemId, position))
      },
    })
  }, [])

  const { uploadSingleFile } = useFileDropHandler()
  const uploadRef = useRef(uploadSingleFile)
  uploadRef.current = uploadSingleFile

  const setFileDropOverride = useDndStore((s) => s.setFileDropOverride)
  useEffect(() => {
    if (!enabled) return
    const handler: FileDropOverride = async (dropResult, clientCoords) => {
      const basePosition = screenToFlowPositionRef.current(clientCoords)
      try {
        const files = dropResult.files
        const results = await Promise.allSettled(
          files.map((f) => uploadRef.current(f.file, null, { navigate: false })),
        )
        results.forEach((result, i) => {
          if (result.status === 'rejected') {
            handleError(result.reason, 'Failed to upload file to canvas')
            return
          }
          if (!result.value) return
          createNodeRef.current(
            createEmbedCanvasNode(result.value.id, {
              x: basePosition.x + i * STACK_OFFSET,
              y: basePosition.y + i * STACK_OFFSET,
            }),
          )
        })
      } catch (error) {
        handleError(error, 'Failed to upload files to canvas')
      }
    }
    setFileDropOverride(handler)
    return () => setFileDropOverride(null)
  }, [enabled, setFileDropOverride])

  return { dropOverlayRef, isDropTarget, isFileDropTarget }
}
