import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Node } from '@xyflow/react'
import type * as Y from 'yjs'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasDropZoneData } from '~/features/dnd/utils/dnd-registry'
import type { FileDropOverride } from '~/features/dnd/stores/dnd-store'
import { handleError } from '~/shared/utils/logger'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useFileDropHandler } from '~/features/dnd/hooks/useFileDropHandler'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { CANVAS_DROP_ZONE_TYPE, getDragItemId } from '~/features/dnd/utils/dnd-registry'

const EMBED_SIDEBAR_WIDTH = 320
const EMBED_SIDEBAR_HEIGHT = 240
const EMBED_FILE_WIDTH = 200
const EMBED_FILE_HEIGHT = 52
const STACK_OFFSET = 20

interface UseCanvasDropTargetOptions {
  nodesMap: Y.Map<Node>
  canvasId: Id<'sidebarItems'>
  canEdit: boolean
  isSelectMode: boolean
}

export function useCanvasDropTarget({
  nodesMap,
  canvasId,
  canEdit,
  isSelectMode,
}: UseCanvasDropTargetOptions) {
  const reactFlow = useReactFlow()

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

  const enabled = canEdit && isSelectMode
  const { isFileDropTarget } = useExternalDropTarget({
    ref: dropOverlayRef,
    parentId: null,
    canAcceptFiles: enabled,
  })

  const nodesMapRef = useRef(nodesMap)
  nodesMapRef.current = nodesMap
  const canvasIdRef = useRef(canvasId)
  canvasIdRef.current = canvasId
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const reactFlowRef = useRef(reactFlow)
  reactFlowRef.current = reactFlow

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
        const position = reactFlowRef.current.screenToFlowPosition({
          x: clientX,
          y: clientY,
        })

        const id = crypto.randomUUID()
        nodesMapRef.current.set(id, {
          id,
          type: 'embed',
          position,
          width: EMBED_SIDEBAR_WIDTH,
          height: EMBED_SIDEBAR_HEIGHT,
          data: { sidebarItemId },
        })
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
      const basePosition = reactFlowRef.current.screenToFlowPosition(clientCoords)
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
          const id = crypto.randomUUID()
          nodesMapRef.current.set(id, {
            id,
            type: 'embed',
            position: {
              x: basePosition.x + i * STACK_OFFSET,
              y: basePosition.y + i * STACK_OFFSET,
            },
            width: EMBED_FILE_WIDTH,
            height: EMBED_FILE_HEIGHT,
            data: { sidebarItemId: result.value.id },
          })
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
