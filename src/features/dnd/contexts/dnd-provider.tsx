import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ClientOnly } from '@tanstack/react-router'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { monitorForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter'
import { containsFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file'
import { toast } from 'sonner'
import { Ban } from 'lucide-react'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { DndContext, DropOutcome } from '~/features/dnd/utils/dnd-registry'
import type { DropResult } from '~/features/file-upload/utils/folder-reader'
import type { DndValue } from '~/features/dnd/hooks/useDnd'
import {
  getDragItemId,
  getDropTargetKey,
  getHighlightId,
  rejectionReasonMessage,
  resolveDropOutcome,
  resolveDropTarget,
} from '~/features/dnd/utils/dnd-registry'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorNavigationContext } from '~/features/sidebar/hooks/useEditorNavigationContext'
import { useFileDropHandler } from '~/features/dnd/hooks/useFileDropHandler'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { useSidebarItemMutations } from '~/features/sidebar/hooks/useSidebarItemMutations'
import {
  useAllSidebarItems,
  useTrashedSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { processDataTransferItems } from '~/features/file-upload/utils/folder-reader'
import { DndProviderContext } from '~/features/dnd/hooks/useDnd'

// ─── Internal Types ──────────────────────────────────────────────────

interface InternalCtx {
  itemsMap: ReadonlyMap<SidebarItemId, AnySidebarItem>
  trashedItemsMap: ReadonlyMap<SidebarItemId, AnySidebarItem>
  getAncestorIds: (id: SidebarItemId) => Array<Id<'folders'>>
  dndContext: DndContext
  handleDropFiles: (
    dropResult: DropResult,
    options?: { campaignId: Id<'campaigns'>; parentId: Id<'folders'> | null },
  ) => Promise<void>
  campaignId: Id<'campaigns'> | null
}

// ─── Overlay ─────────────────────────────────────────────────────────

function DragOverlayContent({
  dragState,
}: {
  dragState: {
    draggedItem: AnySidebarItem
    outcome: DropOutcome | null
  } | null
}) {
  if (!dragState) return null

  const { draggedItem, outcome } = dragState
  const DraggedIcon = getSidebarItemIcon(draggedItem)

  return (
    <div className="bg-background rounded-sm shadow-lg shadow-foreground/25 px-2 py-1 font-semibold flex flex-col items-start w-fit opacity-70">
      <span className="flex items-center gap-1 whitespace-nowrap">
        <DraggedIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="truncate text-xs text-foreground">
          {draggedItem.name}
        </span>
      </span>
      {outcome?.type === 'operation' && (
        <span className="text-muted-foreground whitespace-nowrap text-xs">
          {outcome.label}
        </span>
      )}
      {outcome?.type === 'rejection' && (
        <span className="text-destructive whitespace-nowrap text-xs flex items-center gap-1">
          <Ban className="w-3 h-3" />
          {rejectionReasonMessage(outcome.reason)}
        </span>
      )}
    </div>
  )
}

function DragOverlayPortal({
  overlayRef,
  dragState,
}: {
  overlayRef: React.RefObject<HTMLDivElement | null>
  dragState: {
    draggedItem: AnySidebarItem
    outcome: DropOutcome | null
  } | null
}) {
  return createPortal(
    <div
      ref={overlayRef}
      className="fixed pointer-events-none z-[10000]"
      style={{ top: 0, left: 0, display: 'none' }}
    >
      <DragOverlayContent dragState={dragState} />
    </div>,
    document.body,
  )
}

// ─── Provider ────────────────────────────────────────────────────────

export function DndProvider({ children }: { children: React.ReactNode }) {
  // Collect context from hooks
  const { campaign, campaignId, isDm } = useCampaign()
  const campaignName = campaign.data?.name
  const { navigateToItem } = useEditorNavigationContext()
  const { moveItem } = useSidebarItemMutations()
  const { handleDrop: handleDropFiles } = useFileDropHandler()
  const { itemsMap, parentItemsMap, getAncestorSidebarItems } =
    useAllSidebarItems()
  const { itemsMap: trashedItemsMap } = useTrashedSidebarItems()

  const setSidebarDragTargetId = useSidebarUIStore(
    (s) => s.setSidebarDragTargetId,
  )
  const setDragOutcome = useSidebarUIStore((s) => s.setDragOutcome)
  const setFileDragHoveredId = useSidebarUIStore((s) => s.setFileDragHoveredId)
  const setIsDraggingFiles = useSidebarUIStore((s) => s.setIsDraggingFiles)
  const setIsDraggingElement = useSidebarUIStore((s) => s.setIsDraggingElement)

  const setFolderState = useSidebarUIStore((s) => s.setFolderState)

  // setFolderOpen for DndContext — bakes in campaignId
  const setFolderOpen = useCallback(
    (folderId: Id<'folders'>) => {
      if (campaignId) setFolderState(campaignId, folderId, true)
    },
    [campaignId, setFolderState],
  )

  // Name conflict check for DndContext
  const hasSiblingNameConflict = useCallback(
    (
      name: string,
      parentId: Id<'folders'> | null,
      excludeId?: SidebarItemId,
    ): boolean => {
      const siblings = parentItemsMap.get(parentId) ?? []
      const normalized = name.trim().toLowerCase()
      return siblings.some(
        (s) =>
          s.name.trim().toLowerCase() === normalized && s._id !== excludeId,
      )
    },
    [parentItemsMap],
  )

  // DndContext for registry resolve functions
  const dndContext: DndContext = useMemo(
    () => ({
      moveItem,
      navigateToItem,
      campaignId: campaignId ?? null,
      campaignName,
      isDm: isDm ?? false,
      setFolderOpen,
      hasSiblingNameConflict,
    }),
    [
      moveItem,
      navigateToItem,
      campaignId,
      campaignName,
      isDm,
      setFolderOpen,
      hasSiblingNameConflict,
    ],
  )

  // Resolve helper exposed via context
  const resolveItem = useCallback(
    (id: SidebarItemId): AnySidebarItem | null =>
      itemsMap.get(id) ?? trashedItemsMap.get(id) ?? null,
    [itemsMap, trashedItemsMap],
  )

  // Wrapped resolveDropTarget with maps baked in
  const getAncestorIds = useCallback(
    (id: SidebarItemId) => getAncestorSidebarItems(id).map((a) => a._id),
    [getAncestorSidebarItems],
  )

  const resolveDropTargetWrapped = useCallback(
    (rawData: Record<string, unknown>) =>
      resolveDropTarget(rawData, itemsMap, trashedItemsMap, getAncestorIds),
    [itemsMap, trashedItemsMap, getAncestorIds],
  )

  // Single ref for all monitor closures — one ref instead of 6+
  const ctxRef = useRef<InternalCtx>({
    itemsMap,
    trashedItemsMap,
    getAncestorIds: (id) => getAncestorSidebarItems(id).map((a) => a._id),
    dndContext,
    handleDropFiles,
    campaignId: campaignId ?? null,
  })
  ctxRef.current = {
    itemsMap,
    trashedItemsMap,
    getAncestorIds: (id) => getAncestorSidebarItems(id).map((a) => a._id),
    dndContext,
    handleDropFiles,
    campaignId: campaignId ?? null,
  }

  // Drag state for overlay (only the overlay re-renders when this changes)
  const [dragState, setDragState] = useState<{
    draggedItem: AnySidebarItem
    outcome: DropOutcome | null
  } | null>(null)

  const overlayRef = useRef<HTMLDivElement>(null)
  const lastDropTargetKeyRef = useRef<string | null>(null)

  const isElementDragRef = useRef(false)

  // Capture-phase handlers: prevent browser from opening dragged files,
  // and mark events as `synthetic` during element drags to avoid BlockNote
  // SideMenu interference
  useEffect(() => {
    const isFileDrag = (e: DragEvent) => {
      if (!e.dataTransfer) return false
      for (const type of e.dataTransfer.types) {
        if (type === 'Files') return true
      }
      return false
    }
    const handleDragOver = (e: DragEvent) => {
      if (
        isElementDragRef.current &&
        !(e.target as Element)?.closest?.('.bn-editor')
      ) {
        ;(e as unknown as Record<string, unknown>).synthetic = true
      }
      if (!isFileDrag(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
    }
    const handleDrop = (e: DragEvent) => {
      if (
        isElementDragRef.current &&
        !(e.target as Element)?.closest?.('.bn-editor')
      ) {
        ;(e as unknown as Record<string, unknown>).synthetic = true
      }
      if (isFileDrag(e)) e.preventDefault()
    }
    document.addEventListener('dragover', handleDragOver, true)
    document.addEventListener('drop', handleDrop, true)
    return () => {
      document.removeEventListener('dragover', handleDragOver, true)
      document.removeEventListener('drop', handleDrop, true)
    }
  }, [])

  // Element drag monitor — handles overlay + drop execution
  useEffect(() => {
    return monitorForElements({
      onDragStart: ({ source, location }) => {
        isElementDragRef.current = true

        const ctx = ctxRef.current
        const sid = getDragItemId(source.data)
        const draggedItem = sid
          ? (ctx.itemsMap.get(sid) ?? ctx.trashedItemsMap.get(sid) ?? null)
          : null
        const input = location.current.input

        if (overlayRef.current) {
          overlayRef.current.style.display = ''
          overlayRef.current.style.transform = `translate(${input.clientX + 8}px, ${input.clientY + 8}px)`
        }

        lastDropTargetKeyRef.current = null
        setDragOutcome(null)
        setIsDraggingElement(true)
        if (draggedItem) setDragState({ draggedItem, outcome: null })
      },
      onDrag: ({ location, source }) => {
        const input = location.current.input
        if (overlayRef.current) {
          overlayRef.current.style.transform = `translate(${input.clientX + 8}px, ${input.clientY + 8}px)`
        }

        const topTarget = location.current.dropTargets[0]
        const rawDropTarget = topTarget ? topTarget.data : null
        const key = getDropTargetKey(rawDropTarget)

        if (key !== lastDropTargetKeyRef.current) {
          lastDropTargetKeyRef.current = key
          const ctx = ctxRef.current

          const dropTarget = rawDropTarget
            ? resolveDropTarget(
                rawDropTarget,
                ctx.itemsMap,
                ctx.trashedItemsMap,
                ctx.getAncestorIds,
              )
            : null

          const sid = getDragItemId(source.data)
          const draggedItem = sid
            ? (ctx.itemsMap.get(sid) ?? ctx.trashedItemsMap.get(sid) ?? null)
            : null

          const outcome = resolveDropOutcome(
            draggedItem,
            dropTarget,
            ctx.dndContext,
          )

          setDragState((prev) => {
            if (!prev) return null
            return { ...prev, outcome }
          })

          setSidebarDragTargetId(getHighlightId(dropTarget))
          setDragOutcome(outcome)
        }
      },
      onDrop: async ({ source, location }) => {
        isElementDragRef.current = false

        // Synchronous: hide overlay, clear store
        if (overlayRef.current) overlayRef.current.style.display = 'none'
        lastDropTargetKeyRef.current = null
        setDragState(null)
        setSidebarDragTargetId(null)
        setDragOutcome(null)
        setIsDraggingElement(false)

        // Async: execute drop via registry
        const topTarget = location.current.dropTargets[0]
        if (!topTarget) return

        const ctx = ctxRef.current
        const dragSid = getDragItemId(source.data)
        if (!dragSid) return
        const draggedItem =
          ctx.itemsMap.get(dragSid) ?? ctx.trashedItemsMap.get(dragSid) ?? null
        if (!draggedItem) return

        const targetData = resolveDropTarget(
          topTarget.data,
          ctx.itemsMap,
          ctx.trashedItemsMap,
          ctx.getAncestorIds,
        )
        if (!targetData) return

        const outcome = resolveDropOutcome(
          draggedItem,
          targetData,
          ctx.dndContext,
        )
        if (outcome?.type !== 'operation' || !outcome.execute) return

        try {
          await outcome.execute()
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to move item'
          toast.error(message)
        }
      },
    })
  }, [setSidebarDragTargetId, setDragOutcome, setIsDraggingElement])

  // External file drag monitor
  useEffect(() => {
    return monitorForExternal({
      canMonitor: ({ source }) => containsFiles({ source }),
      onDragStart: () => setIsDraggingFiles(true),
      onDropTargetChange: ({ location }) => {
        const target = location.current.dropTargets[0]
        const rawParentId = target?.data?.parentId
        const parentId =
          typeof rawParentId === 'string'
            ? (rawParentId as Id<'folders'>)
            : null
        setFileDragHoveredId(parentId)
      },
      onDrop: async ({ source, location }) => {
        setIsDraggingFiles(false)
        setFileDragHoveredId(null)
        const target = location.current.dropTargets[0]
        const ctx = ctxRef.current
        if (!target || !ctx.campaignId) return
        const rawParentId = target.data.parentId
        const parentId =
          typeof rawParentId === 'string'
            ? (rawParentId as Id<'folders'>)
            : null
        try {
          const dropResult = await processDataTransferItems(source.items)
          if (
            dropResult.files.length > 0 ||
            dropResult.rootFolders.length > 0
          ) {
            await ctx.handleDropFiles(dropResult, {
              campaignId: ctx.campaignId,
              parentId,
            })
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to upload files'
          toast.error(message)
        }
      },
    })
  }, [setIsDraggingFiles, setFileDragHoveredId])

  // Context value
  const value: DndValue = useMemo(
    () => ({
      resolveItem,
      resolveDropTarget: resolveDropTargetWrapped,
    }),
    [resolveItem, resolveDropTargetWrapped],
  )

  return (
    <DndProviderContext.Provider value={value}>
      <div className="flex flex-col flex-1 min-h-0">{children}</div>
      <ClientOnly fallback={null}>
        <DragOverlayPortal overlayRef={overlayRef} dragState={dragState} />
      </ClientOnly>
    </DndProviderContext.Provider>
  )
}
