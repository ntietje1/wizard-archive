import { useEffect, useRef } from 'react'
import { monitorForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter'
import { containsFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file'
import type { DndExternalFileDropContext } from './file-drop'
import { processDataTransferItems } from './file-drop'
import { useDndStore } from './store'
import { dropTargetBelongsToRuntime, getDropTargetKey, resolveDropTarget } from './drop-target-data'
import { handleError } from '../errors/handle-error'
import type { ElementDragMonitorContext } from './monitor-context'
import { resolveDropCommand } from './drop-command-planner'
import { executePlannedDropCommand } from './drop-command-execution'

type ExternalDropTargetChangeArgs = {
  location: { current: { dropTargets: Array<{ data: Record<string, unknown> }> } }
}

type ExternalDropArgs = {
  source: { items: ReadonlyArray<DataTransferItem> }
  location: {
    current: {
      input: { clientX: number; clientY: number }
      dropTargets: Array<{ data: Record<string, unknown> }>
    }
  }
}

type ExternalDragMonitorContext = DndExternalFileDropContext &
  Pick<ElementDragMonitorContext, 'catalog' | 'dndContext' | 'dropPlanningContext'>

export function useExternalDragMonitor(
  ctxRef: React.RefObject<ExternalDragMonitorContext>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const setIsDraggingFiles = useDndStore((s) => s.setIsDraggingFiles)
  const setExternalFileDropTargetKey = useDndStore((s) => s.setExternalFileDropTargetKey)
  const handleDragStartRef = useRef<() => void>(() => {})
  const handleDropTargetChangeRef = useRef<(args: ExternalDropTargetChangeArgs) => void>(() => {})
  const handleDropRef = useRef<(args: ExternalDropArgs) => Promise<void>>(async () => {})

  handleDragStartRef.current = () => setIsDraggingFiles(true)
  handleDropTargetChangeRef.current = ({ location }) => {
    const target = location.current.dropTargets[0]
    const ctx = ctxRef.current
    if (!dropTargetBelongsToRuntime(target?.data ?? null, ctx?.runtimeId ?? null)) {
      setExternalFileDropTargetKey(null)
      return
    }
    setExternalFileDropTargetKey(getDropTargetKey(target?.data ?? null))
  }
  handleDropRef.current = async ({ source, location }) => {
    setIsDraggingFiles(false)
    setExternalFileDropTargetKey(null)
    const ctx = ctxRef.current
    if (!ctx) return
    const rawTarget = location.current.dropTargets[0]
    if (rawTarget && !dropTargetBelongsToRuntime(rawTarget.data, ctx.runtimeId ?? null)) return
    const target = rawTarget
    try {
      const dropResult = await processDataTransferItems(source.items)
      if (dropResult.files.length === 0 && dropResult.rootFolders.length === 0) return

      const resolvedTarget = target
        ? resolveDropTarget(target.data, ctx.catalog, { runtimeId: ctx.runtimeId ?? null })
        : null
      const input = location.current.input
      await executePlannedDropCommand(
        resolveDropCommand({
          payload: { kind: 'externalFiles', dropResult },
          target: resolvedTarget,
          ctx: ctx.dropPlanningContext,
        }),
        input,
        {
          ...ctx.dndContext,
          handleDropFiles: ctx.handleDropFiles,
          setBatchDecision: () => undefined,
        },
      )
    } catch (error) {
      handleError(error, 'Failed to upload files')
    }
  }

  useEffect(() => {
    const resetFileDragState = () => {
      setIsDraggingFiles(false)
      setExternalFileDropTargetKey(null)
    }

    if (!enabled) {
      resetFileDragState()
      return
    }

    const cleanup = monitorForExternal({
      canMonitor: ({ source }) => containsFiles({ source }),
      onDragStart: () => handleDragStartRef.current(),
      onDropTargetChange: (args) => handleDropTargetChangeRef.current(args),
      onDrop: (args) => handleDropRef.current(args),
    })

    return () => {
      cleanup()
      resetFileDragState()
    }
  }, [enabled, setExternalFileDropTargetKey, setIsDraggingFiles])
}
