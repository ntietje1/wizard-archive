import { useEffect, useRef } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { createEmbedCanvasNode } from '../../nodes/embed/embed-node-creation'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasDocumentNode } from 'convex/canvases/validation'
import type { CanvasDropZoneData } from '~/features/dnd/utils/dnd-registry'
import type { FileDropOverride } from '~/features/dnd/stores/dnd-store'
import { handleError } from '~/shared/utils/logger'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useFileDropHandler } from '~/features/dnd/hooks/useFileDropHandler'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import {
  CANVAS_DROP_ZONE_TYPE,
  rejectionReasonMessage,
  resolveDropCommand,
} from '~/features/dnd/utils/dnd-registry'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { resolveNormalizedDraggedSidebarItems } from '~/features/dnd/utils/sidebar-drag-items'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'

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
  const { itemsMap } = useActiveSidebarItems()
  const { campaignId } = useCampaign()

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
  const createNodesRef = useRef(createNodes)
  createNodesRef.current = createNodes
  const providerRef = useRef(provider)
  providerRef.current = provider
  const screenToCanvasPositionRef = useRef(screenToCanvasPosition)
  screenToCanvasPositionRef.current = screenToCanvasPosition
  const itemsMapRef = useRef(itemsMap)
  itemsMapRef.current = itemsMap

  useEffect(() => {
    return monitorForElements({
      onDrop: ({ source, location }) => {
        if (!enabledRef.current) return
        const topTarget = location.current.dropTargets[0]
        if (!topTarget) return

        const targetData = topTarget.data
        if (targetData.type !== CANVAS_DROP_ZONE_TYPE) return
        if (targetData.canvasId !== canvasIdRef.current) return

        const { clientX, clientY } = location.current.input
        const position = screenToCanvasPositionRef.current({
          x: clientX,
          y: clientY,
        })

        try {
          const sidebarItems = resolveNormalizedDraggedSidebarItems({
            sourceData: source.data,
            activeItemsMap: itemsMapRef.current,
          })
          const command = resolveDropCommand(
            sidebarItems,
            { type: CANVAS_DROP_ZONE_TYPE, canvasId: canvasIdRef.current },
            {
              moveItems: () => Promise.resolve(),
              restoreItems: () => Promise.resolve(),
              trashItems: () => Promise.resolve(),
              navigateToItem: () => Promise.resolve(),
              campaignId: campaignId ?? null,
              campaignName: undefined,
              isDm: true,
              setFolderOpen: () => undefined,
            },
          )
          if (command.status === 'blocked') {
            handleError(new Error(rejectionReasonMessage(command.reason)), 'Cannot drop items here')
            return
          }
          if (command.status === 'noop' || command.action !== 'embed') return

          const createEmbeds = async () => {
            const nodes = command.items.map((sidebarItem, index) =>
              createEmbedCanvasNode(sidebarItem._id, {
                x: position.x + index * STACK_OFFSET,
                y: position.y + index * STACK_OFFSET,
              }),
            )
            createNodesRef.current(nodes)
            await providerRef.current?.flushUpdates()
          }

          if (command.status === 'partial' || command.status === 'failed') {
            useDndStore.getState().setBatchDecision({ command, onConfirm: createEmbeds })
            return
          }
          void createEmbeds().catch((error) => handleError(error, 'Failed to add items to canvas'))
        } catch (error) {
          handleError(error, 'Failed to resolve dragged sidebar items')
        }
      },
    })
  }, [campaignId])

  const { uploadSingleFile } = useFileDropHandler()
  const uploadRef = useRef(uploadSingleFile)
  uploadRef.current = uploadSingleFile

  const setFileDropOverride = useDndStore((s) => s.setFileDropOverride)
  useEffect(() => {
    if (!enabled) return
    const handler: FileDropOverride = async (dropResult, clientCoords) => {
      const basePosition = screenToCanvasPositionRef.current(clientCoords)
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
          createNodesRef.current([
            createEmbedCanvasNode(result.value.id, {
              x: basePosition.x + i * STACK_OFFSET,
              y: basePosition.y + i * STACK_OFFSET,
            }),
          ])
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
