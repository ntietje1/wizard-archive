import { useRef } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { DndExecutionContext, DndMonitorCtx } from '~/features/dnd/types'
import type { DndValue } from '~/features/dnd/hooks/useDnd'
import { resolveDropTarget } from '~/features/dnd/utils/drop-target-data'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useFileDropHandler } from '~/features/dnd/hooks/useFileDropHandler'
import { useSidebarItemOperations } from '~/features/sidebar/operations/useSidebarItemOperations'
import { useActiveSidebarItems, useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { DndProviderContext } from '~/features/dnd/hooks/useDnd'
import { DragOverlayPortal } from '~/features/dnd/components/drag-overlay'
import { DndBatchDecisionDialog } from '~/features/dnd/components/dnd-batch-decision-dialog'
import { useElementDragMonitor } from '~/features/dnd/hooks/useElementDragMonitor'
import { useExternalDragMonitor } from '~/features/dnd/hooks/useExternalDragMonitor'

export function DndProvider({ children }: { children: React.ReactNode }) {
  const { campaign, campaignId, isDm } = useCampaign()
  const campaignName = campaign.data?.name ?? null
  const { navigateToItem } = useEditorNavigation()
  const itemOperations = useSidebarItemOperations()
  const { handleDrop: handleDropFiles } = useFileDropHandler()
  const { itemsMap, getAncestorSidebarItems } = useActiveSidebarItems()
  const { itemsMap: trashedItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
  const allItemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([...itemsMap, ...trashedItemsMap])

  const setFolderState = useSidebarUIStore((s) => s.setFolderState)

  const setFolderOpen = (folderId: Id<'sidebarItems'>) => {
    if (campaignId) setFolderState(campaignId, folderId, true)
  }

  const dndContext: DndExecutionContext = {
    moveItems: async (items, parentId) => {
      await itemOperations.moveItems(items, parentId)
    },
    restoreItems: async (items, parentId) => {
      await itemOperations.restoreItems(items, parentId)
    },
    trashItems: async (items) => {
      await itemOperations.trashItems(items)
    },
    navigateToItem,
    setFolderOpen,
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
