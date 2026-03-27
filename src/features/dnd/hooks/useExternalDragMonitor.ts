import { useEffect } from 'react'
import { monitorForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter'
import { containsFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file'
import type { Id } from 'convex/_generated/dataModel'
import type { DndMonitorCtx } from '~/features/dnd/types'
import { handleError } from '~/shared/utils/logger'
import { processDataTransferItems } from '~/features/file-upload/utils/folder-reader'
import { useDndStore } from '~/features/dnd/stores/dnd-store'

function extractParentId(
  target: { data: Record<string, unknown> } | undefined,
): Id<'folders'> | null {
  const rawParentId = target?.data?.parentId
  return typeof rawParentId === 'string' ? (rawParentId as Id<'folders'>) : null
}

export function useExternalDragMonitor(ctxRef: React.RefObject<DndMonitorCtx>) {
  const setIsDraggingFiles = useDndStore((s) => s.setIsDraggingFiles)
  const setFileDragHoveredId = useDndStore((s) => s.setFileDragHoveredId)

  useEffect(() => {
    return monitorForExternal({
      canMonitor: ({ source }) => containsFiles({ source }),
      onDragStart: () => setIsDraggingFiles(true),
      onDropTargetChange: ({ location }) => {
        const target = location.current.dropTargets[0]
        const parentId = extractParentId(target)
        setFileDragHoveredId(parentId)
      },
      onDrop: async ({ source, location }) => {
        setIsDraggingFiles(false)
        setFileDragHoveredId(null)
        const target = location.current.dropTargets[0]
        const ctx = ctxRef.current
        if (!target || !ctx?.campaignId) return
        const parentId = extractParentId(target)
        try {
          const dropResult = await processDataTransferItems(source.items)
          if (
            dropResult.files.length > 0 ||
            dropResult.rootFolders.length > 0
          ) {
            await ctx.handleDropFiles(dropResult, { parentId })
          }
        } catch (error) {
          handleError(error, 'Failed to upload files')
        }
      },
    })
  }, [setIsDraggingFiles, setFileDragHoveredId])
}
