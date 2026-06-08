import { useEffect } from 'react'
import { monitorForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter'
import { containsFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file'
import type { Id } from 'convex/_generated/dataModel'
import type { DndMonitorCtx, FileDropDestination } from '~/features/dnd/types'
import { handleError } from '~/shared/utils/logger'
import { processDataTransferItems } from '~/features/file-upload/utils/folder-reader'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { executeRegisteredExternalFileDropCommand } from '~/features/dnd/utils/external-file-drop-command'
import {
  EMPTY_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
  getDropTargetKey,
} from '~/features/dnd/utils/drop-target-data'

function getExternalFileDropDestination(
  target: { data: Record<string, unknown> } | undefined,
): FileDropDestination {
  if (!target) return { kind: 'direct', parentId: null }

  const rawParentId = target.data.parentId
  if (typeof rawParentId === 'string') {
    return { kind: 'direct', parentId: rawParentId as Id<'sidebarItems'> }
  }
  // A present non-string parentId on target.data is an explicit root drop;
  // a missing parentId can still fall through to sidebarItemId or type data.
  if (Object.hasOwn(target.data, 'parentId')) {
    return { kind: 'direct', parentId: null }
  }

  if (typeof target.data.sidebarItemId === 'string') {
    return { kind: 'direct', parentId: target.data.sidebarItemId as Id<'sidebarItems'> }
  }

  if (target.data.type === SIDEBAR_ROOT_DROP_TYPE) {
    return { kind: 'direct', parentId: null }
  }

  if (target.data.type === EMPTY_EDITOR_DROP_TYPE) {
    return { kind: 'assets' }
  }

  return { kind: 'assets' }
}

export function useExternalDragMonitor(ctxRef: React.RefObject<DndMonitorCtx>) {
  const setIsDraggingFiles = useDndStore((s) => s.setIsDraggingFiles)
  const setFileDragHoveredTargetKey = useDndStore((s) => s.setFileDragHoveredTargetKey)

  useEffect(() => {
    return monitorForExternal({
      canMonitor: ({ source }) => containsFiles({ source }),
      onDragStart: () => setIsDraggingFiles(true),
      onDropTargetChange: ({ location }) => {
        const target = location.current.dropTargets[0]
        setFileDragHoveredTargetKey(getDropTargetKey(target?.data ?? null))
      },
      onDrop: async ({ source, location }) => {
        setIsDraggingFiles(false)
        setFileDragHoveredTargetKey(null)
        const target = location.current.dropTargets[0]
        const ctx = ctxRef.current
        if (!target || !ctx?.campaignId) return
        try {
          const dropResult = await processDataTransferItems(source.items)
          if (dropResult.files.length === 0 && dropResult.rootFolders.length === 0) return

          const { clientX, clientY } = location.current.input
          const commandOutcome = await executeRegisteredExternalFileDropCommand({
            target: target.data,
            dropResult,
            input: { clientX, clientY },
          })
          if (commandOutcome.handled) {
            if (commandOutcome.unhandledDropResult) {
              await ctx.handleDropFiles(commandOutcome.unhandledDropResult, {
                destination: getExternalFileDropDestination(target),
              })
            }
            return
          }

          const override = useDndStore.getState().fileDropOverride
          if (override) {
            await override(dropResult, { x: clientX, y: clientY })
          } else {
            await ctx.handleDropFiles(dropResult, {
              destination: getExternalFileDropDestination(target),
            })
          }
        } catch (error) {
          handleError(error, 'Failed to upload files')
        }
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIsDraggingFiles, setFileDragHoveredTargetKey])
}
