import type { ResourceId } from '../../resources/domain-id'
import { useEffect, useMemo, useRef } from 'react'
import {
  createEmbedCanvasNode,
  createResourceEmbedCanvasNode,
} from '../nodes/embed/embed-node-creation'
import type { CanvasDropZoneData } from '../../drag-drop/drop-target-data'
import { useExternalDropTarget } from '../../drag-drop/use-external-drop-target'
import { useExternalUrlDropTarget } from '../../drag-drop/use-external-url-drop-target'
import { useDndDropTarget } from '../../drag-drop/use-drop-target'
import { useMergedRef } from '../../drag-drop/ref-utils'
import { CANVAS_DROP_ZONE_TYPE } from '../../drag-drop/drop-target-data'
import { resolveExternalFileDropTarget } from '../../drag-drop/external-file-drop-target'
import {
  registerSurfaceExternalUrlDropExecutor,
  registerSurfaceFileImportExecutor,
} from '../../drag-drop/drop-command-execution'
import { registerSurfaceDropExecutor } from '../../drag-drop/surface-command'
import type { CanvasCollaborationProvider } from '../session-contract'
import type { CanvasDocumentNode } from '../document-contract'
import type { CanvasDocumentWriter } from '../tools/canvas-tool-types'
import { useCanAcceptExternalFiles, useDndRuntimeDropData } from '../../drag-drop/context'

import type { EmbedTargetUploadFileResult } from '../../embeds/target-operations'
import { resourceEmbedTarget } from '../../embeds/utils/targets'
import { runWithPendingEmbedUpload } from '../../embeds/pending-upload'
import { toast } from 'sonner'
import { getClientErrorMessage } from '../../../../../shared/errors/client'

const STACK_OFFSET = 20

function reportCanvasDropError(error: unknown, fallbackMessage: string) {
  toast.error(getClientErrorMessage(error) ?? fallbackMessage)
  console.error(error)
}

interface UseCanvasDropTargetOptions {
  canvasId: ResourceId
  enabled: boolean
  createNodes: (nodes: ReadonlyArray<CanvasDocumentNode>) => void
  patchNodeData: CanvasDocumentWriter['patchNodeData']
  provider: CanvasCollaborationProvider | null
  screenToCanvasPosition: (position: { x: number; y: number }) => { x: number; y: number }
  uploadFile?: (file: File) => Promise<EmbedTargetUploadFileResult>
}

export function useCanvasDropTarget({
  canvasId,
  enabled,
  createNodes,
  patchNodeData,
  provider,
  screenToCanvasPosition,
  uploadFile,
}: UseCanvasDropTargetOptions) {
  const dropOverlayRef = useRef<HTMLDivElement>(null)
  const canAcceptExternalFiles = useCanAcceptExternalFiles()

  const dropData = useMemo<CanvasDropZoneData>(
    () => ({
      type: CANVAS_DROP_ZONE_TYPE,
      canvasId,
    }),
    [canvasId],
  )
  const scopedDropData = useDndRuntimeDropData(dropData)
  const { dropTargetRef, isDropTarget } = useDndDropTarget({
    data: scopedDropData,
    canDrop: enabled,
  })

  const { externalDropTargetRef, isFileDropTarget } = useExternalDropTarget({
    data: scopedDropData,
    enabled: enabled && canAcceptExternalFiles,
    fileDropTarget: resolveExternalFileDropTarget(scopedDropData, {
      surfaceFileUploadAvailable: Boolean(uploadFile),
    }),
  })
  const { externalUrlDropTargetRef, isUrlDropTarget } = useExternalUrlDropTarget({
    data: scopedDropData,
    enabled,
  })
  const dropOverlayTargetRef = useMergedRef(
    dropOverlayRef,
    dropTargetRef,
    externalDropTargetRef,
    externalUrlDropTargetRef,
  )

  useEffect(() => {
    if (!enabled) return
    return registerSurfaceDropExecutor({
      action: 'embed',
      target: scopedDropData,
      execute: async (embedCommand, input) => {
        const position = screenToCanvasPosition({
          x: input.clientX,
          y: input.clientY,
        })

        const nodes = embedCommand.items.map((sidebarItem, index) =>
          createResourceEmbedCanvasNode(sidebarItem.id, {
            x: position.x + index * STACK_OFFSET,
            y: position.y + index * STACK_OFFSET,
          }),
        )
        createNodes(nodes)
        await provider?.flushUpdates()
      },
    })
  }, [createNodes, enabled, provider, scopedDropData, screenToCanvasPosition])

  useEffect(() => {
    if (!enabled || !canAcceptExternalFiles || !uploadFile) return
    return registerSurfaceFileImportExecutor({
      commandId: 'surface-file-import.canvas',
      target: scopedDropData,
      execute: async (command, input) => {
        const { dropResult } = command
        if (dropResult.files.length === 0) return { uploadedCount: 0 }

        const basePosition = screenToCanvasPosition({
          x: input.clientX,
          y: input.clientY,
        })
        const pendingNodes = dropResult.files.map((_, index) =>
          createEmbedCanvasNode(
            { kind: 'empty' },
            {
              x: basePosition.x + index * STACK_OFFSET,
              y: basePosition.y + index * STACK_OFFSET,
            },
          ),
        )
        createNodes(pendingNodes)
        const uploadPromises = dropResult.files.map(async (fileEntry, index) => {
          const pendingNode = pendingNodes[index]
          if (!pendingNode) return false
          return runWithPendingEmbedUpload(
            'canvas',
            pendingNode.id,
            fileEntry.file.name,
            async () => {
              try {
                const uploadResult = await uploadFile(fileEntry.file)
                if (uploadResult.status !== 'completed') {
                  reportCanvasDropError(uploadResult.error, 'Failed to upload file to canvas')
                  return false
                }
                patchNodeData(
                  new Map([[pendingNode.id, { target: resourceEmbedTarget(uploadResult.itemId) }]]),
                )
                return true
              } catch (error) {
                reportCanvasDropError(error, 'Failed to upload file to canvas')
                return false
              }
            },
          )
        })
        await provider?.flushUpdates()
        const uploadedCount = (await Promise.all(uploadPromises)).filter(Boolean).length
        if (uploadedCount > 0) {
          await provider?.flushUpdates()
        }

        return { uploadedCount }
      },
    })
  }, [
    canAcceptExternalFiles,
    createNodes,
    enabled,
    patchNodeData,
    provider,
    scopedDropData,
    screenToCanvasPosition,
    uploadFile,
  ])

  useEffect(() => {
    if (!enabled) return
    return registerSurfaceExternalUrlDropExecutor({
      commandId: 'surface-url-drop.canvas',
      target: scopedDropData,
      execute: async (command, input) => {
        try {
          const position = screenToCanvasPosition({
            x: input.clientX,
            y: input.clientY,
          })
          createNodes([createEmbedCanvasNode(command.embedTarget, position)])
          await provider?.flushUpdates()
        } catch (error) {
          reportCanvasDropError(error, 'Failed to drop external URL on canvas')
        }
      },
    })
  }, [createNodes, enabled, provider, scopedDropData, screenToCanvasPosition])

  return {
    dropOverlayRef: dropOverlayTargetRef,
    enabled,
    isDropTarget: isDropTarget || isUrlDropTarget,
    isFileDropTarget,
  }
}
