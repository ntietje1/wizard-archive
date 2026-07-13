import { useCallback, useId, useMemo, useRef, useSyncExternalStore } from 'react'
import type { DndExternalFileDropCapability, DndExternalFileDropContext } from './file-drop'
import type { DndExecutionContext, ElementDragMonitorContext } from './monitor-context'
import type { DndValue } from './context'
import type { DropTargetCatalog } from './drop-target-data'
import { resolveDropTarget } from './drop-target-data'
import { DndProviderContext } from './context'
import { resolveDropCommand } from './drop-command-planner'
import { executePlannedDropCommand } from './drop-command-execution'
import { DragOverlayPortal } from './drag-overlay'
import { DndBatchDecisionDialog } from './batch-decision-dialog'
import { useElementDragMonitor } from './use-element-drag-monitor'
import { useExternalDragMonitor } from './use-external-drag-monitor'
import { DndStoreContext, createDndStore } from './store'
import type { ResourceOperationItems } from '../filesystem/catalog'
import type { FileSystemPaths } from '../filesystem/catalog-paths'

interface DndRuntimeProviderProps {
  catalog: DropTargetCatalog
  children: React.ReactNode
  dndContext: DndExecutionContext
  dropPlanningContext: ElementDragMonitorContext['dropPlanningContext']
  externalFiles: DndExternalFileDropCapability
  operationItems: ResourceOperationItems
  paths: Pick<FileSystemPaths, 'getVisibleItemLinkPath'>
}

const subscribeToClientMount = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

function ClientMounted({ children }: { children: React.ReactNode }) {
  const isMounted = useSyncExternalStore(
    subscribeToClientMount,
    getClientSnapshot,
    getServerSnapshot,
  )

  return isMounted ? children : null
}

export function DndRuntimeProvider({
  catalog,
  children,
  dndContext,
  dropPlanningContext,
  externalFiles,
  operationItems,
  paths,
}: DndRuntimeProviderProps) {
  const runtimeId = useId()
  const dndStoreRef = useRef<ReturnType<typeof createDndStore> | null>(null)
  const dndStore = dndStoreRef.current ?? (dndStoreRef.current = createDndStore())

  const canAcceptExternalFiles = externalFiles.status === 'enabled'
  const handleDropFiles = externalFiles.handleDropFiles
  const ctxRef = useRef<ElementDragMonitorContext & DndExternalFileDropContext>(null!)
  ctxRef.current = {
    catalog,
    dndContext,
    dropPlanningContext,
    handleDropFiles,
    operationItems,
    runtimeId,
  }

  const dispatchDropPayload: DndValue['dispatchDropPayload'] = useCallback(
    async ({ dropInput, payload, rawTarget }) => {
      const ctx = ctxRef.current
      const target = rawTarget
        ? resolveDropTarget(rawTarget, ctx.catalog, { runtimeId: ctx.runtimeId ?? null })
        : null

      await executePlannedDropCommand(
        resolveDropCommand({ payload, target, ctx: ctx.dropPlanningContext }),
        dropInput,
        {
          ...ctx.dndContext,
          handleDropFiles: ctx.handleDropFiles,
          setBatchDecision: dndStore.getState().setBatchDecision,
        },
      )
    },
    [dndStore],
  )

  const value: DndValue = useMemo(
    () => ({
      canAcceptExternalFiles,
      dispatchDropPayload,
      getItemLinkPath: paths.getVisibleItemLinkPath,
      runtimeId,
    }),
    [canAcceptExternalFiles, dispatchDropPayload, paths.getVisibleItemLinkPath, runtimeId],
  )

  return (
    <DndStoreContext.Provider value={dndStore}>
      <DndProviderContext.Provider value={value}>
        <div className="flex flex-col flex-1 min-h-0">{children}</div>
        <DndRuntimeEffects ctxRef={ctxRef} canAcceptExternalFiles={canAcceptExternalFiles} />
      </DndProviderContext.Provider>
    </DndStoreContext.Provider>
  )
}

function DndRuntimeEffects({
  canAcceptExternalFiles,
  ctxRef,
}: {
  canAcceptExternalFiles: boolean
  ctxRef: React.RefObject<ElementDragMonitorContext & DndExternalFileDropContext>
}) {
  const { overlayRef, dragState } = useElementDragMonitor(ctxRef)
  useExternalDragMonitor(ctxRef, { enabled: canAcceptExternalFiles })

  return (
    <ClientMounted>
      <DragOverlayPortal overlayRef={overlayRef} dragState={dragState} />
      <DndBatchDecisionDialog />
    </ClientMounted>
  )
}
