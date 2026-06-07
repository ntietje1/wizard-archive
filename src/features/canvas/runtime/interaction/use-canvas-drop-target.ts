import { useEffect, useRef } from 'react'
import {
  createEmbedCanvasNode,
  createSidebarItemEmbedCanvasNode,
} from '../../nodes/embed/embed-node-creation'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasDropZoneData } from '~/features/dnd/utils/drop-target-data'
import type { FileDropOverride } from '~/features/dnd/stores/dnd-store'
import { handleError } from '~/shared/utils/logger'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useEmbedUpload } from '~/features/embeds/hooks/use-embed-upload'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { CANVAS_DROP_ZONE_TYPE } from '~/features/dnd/utils/drop-target-data'
import { registerSurfaceDropExecutor } from '~/features/dnd/utils/surface-drop-command'
import { getExternalUrlDropTarget } from '~/features/embeds/utils/embed-targets'
import type { ConvexYjsProvider } from '~/shared/collaboration/convex-yjs-provider'
import type { CanvasDocumentNode } from '~/features/canvas/domain/canvas-document'

const STACK_OFFSET = 20

interface UseCanvasDropTargetOptions {
  canvasId: Id<'sidebarItems'>
  enabled: boolean
  createNodes: (nodes: ReadonlyArray<CanvasDocumentNode>) => void
  provider: ConvexYjsProvider | null
  screenToCanvasPosition: (position: { x: number; y: number }) => { x: number; y: number }
}

export function useCanvasDropTarget({
  canvasId,
  enabled,
  createNodes,
  provider,
  screenToCanvasPosition,
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

  const createNodesRef = useRef(createNodes)
  createNodesRef.current = createNodes
  const providerRef = useRef(provider)
  providerRef.current = provider
  const screenToCanvasPositionRef = useRef(screenToCanvasPosition)
  screenToCanvasPositionRef.current = screenToCanvasPosition

  useEffect(() => {
    if (!enabled) return
    return registerSurfaceDropExecutor({
      action: 'embed',
      target: { type: CANVAS_DROP_ZONE_TYPE, canvasId },
      execute: async (embedCommand, input) => {
        const position = screenToCanvasPositionRef.current({
          x: input.clientX,
          y: input.clientY,
        })

        const nodes = embedCommand.items.map((sidebarItem, index) =>
          createSidebarItemEmbedCanvasNode(sidebarItem._id, {
            x: position.x + index * STACK_OFFSET,
            y: position.y + index * STACK_OFFSET,
          }),
        )
        createNodesRef.current(nodes)
        await providerRef.current?.flushUpdates()
      },
    })
  }, [canvasId, enabled])

  const { uploadEmbedFile } = useEmbedUpload()
  const uploadRef = useRef(uploadEmbedFile)
  uploadRef.current = uploadEmbedFile

  const setFileDropOverride = useDndStore((s) => s.setFileDropOverride)
  useEffect(() => {
    if (!enabled) return
    const handler: FileDropOverride = async (dropResult, clientCoords) => {
      const basePosition = screenToCanvasPositionRef.current(clientCoords)
      try {
        const files = dropResult.files
        const results = await Promise.allSettled(files.map((f) => uploadRef.current(f.file)))
        const nodes: Array<CanvasDocumentNode> = []
        results.forEach((result) => {
          if (result.status === 'rejected') {
            handleError(result.reason, 'Failed to upload file to canvas')
            return
          }
          if (!result.value) return
          const index = nodes.length
          nodes.push(
            createSidebarItemEmbedCanvasNode(result.value.id, {
              x: basePosition.x + index * STACK_OFFSET,
              y: basePosition.y + index * STACK_OFFSET,
            }),
          )
        })
        if (nodes.length > 0) {
          createNodesRef.current(nodes)
          await providerRef.current?.flushUpdates()
        }
      } catch (error) {
        handleError(error, 'Failed to upload files to canvas')
      }
    }
    setFileDropOverride(handler)
    return () => setFileDropOverride(null)
  }, [enabled, setFileDropOverride])

  useEffect(() => {
    const el = dropOverlayRef.current
    if (!enabled || !el) return

    const handleDragOver = (event: DragEvent) => {
      if (!event.dataTransfer || event.dataTransfer.types.includes('Files')) return
      if (getExternalUrlDropTarget(event.dataTransfer)) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDrop = async (event: DragEvent) => {
      if (!event.dataTransfer || event.dataTransfer.types.includes('Files')) return
      const target = getExternalUrlDropTarget(event.dataTransfer)
      if (!target) return

      event.preventDefault()
      const position = screenToCanvasPositionRef.current({
        x: event.clientX,
        y: event.clientY,
      })
      createNodesRef.current([createEmbedCanvasNode(target, position)])
      await providerRef.current?.flushUpdates()
    }

    el.addEventListener('dragover', handleDragOver)
    el.addEventListener('drop', handleDrop)
    return () => {
      el.removeEventListener('dragover', handleDragOver)
      el.removeEventListener('drop', handleDrop)
    }
  }, [enabled])

  return { dropOverlayRef, isDropTarget, isFileDropTarget }
}
