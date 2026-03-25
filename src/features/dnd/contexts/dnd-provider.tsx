import { useRef } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { DndContext } from '~/features/dnd/utils/dnd-registry'
import type { DndValue } from '~/features/dnd/hooks/useDnd'
import type { DndMonitorCtx } from '~/features/dnd/types'
import { resolveDropTarget } from '~/features/dnd/utils/dnd-registry'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorNavigationContext } from '~/features/sidebar/hooks/useEditorNavigationContext'
import { useFileDropHandler } from '~/features/dnd/hooks/useFileDropHandler'
import { useMoveSidebarItem } from '~/features/sidebar/hooks/useMoveSidebarItem'
import {
  useAllSidebarItems,
  useTrashedSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { DndProviderContext } from '~/features/dnd/hooks/useDnd'
import { DragOverlayPortal } from '~/features/dnd/components/drag-overlay'
import { useElementDragMonitor } from '~/features/dnd/hooks/useElementDragMonitor'
import { useExternalDragMonitor } from '~/features/dnd/hooks/useExternalDragMonitor'

export function DndProvider({ children }: { children: React.ReactNode }) {
  const { campaign, campaignId, isDm } = useCampaign()
  const campaignName = campaign.data?.name
  const { navigateToItem } = useEditorNavigationContext()
  const { moveItem } = useMoveSidebarItem()
  const { handleDrop: handleDropFiles } = useFileDropHandler()
  const { itemsMap, parentItemsMap, getAncestorSidebarItems } =
    useAllSidebarItems()
  const { itemsMap: trashedItemsMap } = useTrashedSidebarItems()

  const setFolderState = useSidebarUIStore((s) => s.setFolderState)

  const setFolderOpen = (folderId: Id<'folders'>) => {
    if (campaignId) setFolderState(campaignId, folderId, true)
  }

  const hasSiblingNameConflict = (
    name: string,
    parentId: Id<'folders'> | null,
    excludeId?: SidebarItemId,
  ): boolean => {
    const siblings = parentItemsMap.get(parentId) ?? []
    const normalized = name.trim().toLowerCase()
    return siblings.some(
      (s) => s.name.trim().toLowerCase() === normalized && s._id !== excludeId,
    )
  }

  const dndContext: DndContext = {
    moveItem,
    navigateToItem,
    campaignId: campaignId ?? null,
    campaignName,
    isDm: isDm ?? false,
    setFolderOpen,
    hasSiblingNameConflict,
  }

  const resolveItem = (id: SidebarItemId): AnySidebarItem | null =>
    itemsMap.get(id) ?? trashedItemsMap.get(id) ?? null

  const getAncestorIds = (id: SidebarItemId) =>
    getAncestorSidebarItems(id).map((a) => a._id)

  const resolveDropTargetWrapped = (rawData: Record<string, unknown>) =>
    resolveDropTarget(rawData, itemsMap, trashedItemsMap, getAncestorIds)

  const ctxRef = useRef<DndMonitorCtx>(null!)
  ctxRef.current = {
    itemsMap,
    trashedItemsMap,
    getAncestorIds,
    dndContext,
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
        <DragOverlayPortal overlayRef={overlayRef} dragState={dragState} />
      </ClientOnly>
    </DndProviderContext.Provider>
  )
}
