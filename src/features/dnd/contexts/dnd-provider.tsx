import { useRef } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { DndExecutionContext, DndMonitorCtx } from '~/features/dnd/types'
import type { DndValue } from '~/features/dnd/hooks/useDnd'
import { resolveDropTarget } from '~/features/dnd/utils/drop-target-data'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useFileDropHandler } from '~/features/dnd/hooks/useFileDropHandler'
import { useFileSystem } from '~/features/filesystem/useFileSystem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { DndProviderContext } from '~/features/dnd/hooks/useDnd'
import { DragOverlayPortal } from '~/features/dnd/components/drag-overlay'
import { DndBatchDecisionDialog } from '~/features/dnd/components/dnd-batch-decision-dialog'
import { useElementDragMonitor } from '~/features/dnd/hooks/useElementDragMonitor'
import { useExternalDragMonitor } from '~/features/dnd/hooks/useExternalDragMonitor'

export function DndProvider({ children }: { children: React.ReactNode }) {
  const { campaign, campaignId, isDm } = useCampaign()
  const campaignName = campaign.data?.name ?? null
  const filesystem = useFileSystem()
  const { navigateToItem } = useEditorNavigation()
  const { handleDrop: handleDropFiles } = useFileDropHandler()
  const { itemsMap, getAncestorSidebarItems } = useActiveSidebarItems()
  const { itemsMap: trashedItemsMap } = useTrashSidebarItems()
  const allItemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([...itemsMap, ...trashedItemsMap])

  const dndContext: DndExecutionContext = {
    executeFileSystemDrop: filesystem.executeDrop,
    openItem: (item) => navigateToItem(item.slug, true),
  }
  const dropPlanningContext = {
    campaignId: campaignId ?? null,
    campaignName,
    isDm: isDm ?? false,
  }

  const resolveItem = (id: Id<'sidebarItems'>): AnySidebarItem | null =>
    itemsMap.get(id) ?? trashedItemsMap.get(id) ?? null

  const getAncestorIds = (id: Id<'sidebarItems'>) => getAncestorSidebarItems(id).map((a) => a._id)

  const resolveDropTargetWrapped = (rawData: Record<string, unknown>) =>
    resolveDropTarget(rawData, itemsMap, trashedItemsMap, getAncestorIds)

  const ctxRef = useRef<DndMonitorCtx>(null!)
  ctxRef.current = {
    itemsMap,
    trashedItemsMap,
    allItemsMap,
    getAncestorIds,
    dndContext,
    dropPlanningContext,
    handleDropFiles,
    campaignId: campaignId ?? null,
  }

  const { overlayRef, dragState } = useElementDragMonitor(ctxRef)
  useExternalDragMonitor(ctxRef)

  const value: DndValue = {
    resolveItem,
    resolveDropTarget: resolveDropTargetWrapped,
  }

  return (
    <DndProviderContext.Provider value={value}>
      <div className="flex flex-col flex-1 min-h-0">{children}</div>
      <ClientOnly fallback={null}>
        <>
          <DragOverlayPortal overlayRef={overlayRef} dragState={dragState} />
          <DndBatchDecisionDialog />
        </>
      </ClientOnly>
    </DndProviderContext.Provider>
  )
}
