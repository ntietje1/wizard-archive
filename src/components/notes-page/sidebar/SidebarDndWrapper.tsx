import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ClientOnly } from '@tanstack/react-router'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { monitorForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter'
import { containsFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file'
import { toast } from 'sonner'
import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type {
  SidebarDragData,
  SidebarDropData,
  SidebarItemDropData,
} from '~/lib/dnd-utils'
import {
  EMPTY_EDITOR_DROP_TYPE,
  MAP_DROP_ZONE_TYPE,
  TRASH_DROP_ZONE_TYPE,
  getDragDropAction,
  getDropLabel,
  rejectionReasonMessage,
  validateDrop,
  wouldDropHaveEffect,
} from '~/lib/dnd-utils'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigationContext } from '~/hooks/useEditorNavigationContext'
import { useFileDropHandler } from '~/hooks/useFileDropHandler'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useAllSidebarItems, useTrashedSidebarItems } from '~/hooks/useSidebarItems'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { processDataTransferItems } from '~/lib/folder-reader'
import { Ban } from '~/lib/icons'

interface OverlayContentState {
  draggedItem: AnySidebarItem
  dropTarget: SidebarDropData | null
}

/** Get a stable key for a raw pragmatic-dnd drop target payload to avoid unnecessary re-renders */
function getDropTargetKey(
  target: Record<string, unknown> | null,
): string | null {
  if (!target) return null
  const type = target.type as string
  if (type === MAP_DROP_ZONE_TYPE) return `map:${target.mapId}`
  if (
    type === TRASH_DROP_ZONE_TYPE ||
    type === EMPTY_EDITOR_DROP_TYPE ||
    type === SIDEBAR_ROOT_TYPE
  )
    return type
  // Sidebar item drop targets (all four item types)
  return target.sidebarItemId as string
}

function DragOverlay({ campaignName }: { campaignName: string | undefined }) {
  const [content, setContent] = useState<OverlayContentState | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const lastDropTargetKeyRef = useRef<string | null>(null)

  const { itemsMap, getAncestorSidebarItems } = useAllSidebarItems()
  const { itemsMap: trashedItemsMap } = useTrashedSidebarItems()
  const itemsMapRef = useRef(itemsMap)
  itemsMapRef.current = itemsMap
  const trashedItemsMapRef = useRef(trashedItemsMap)
  trashedItemsMapRef.current = trashedItemsMap
  const getAncestorSidebarItemsRef = useRef(getAncestorSidebarItems)
  getAncestorSidebarItemsRef.current = getAncestorSidebarItems

  const setSidebarDragTargetId = useSidebarUIStore(
    (s) => s.setSidebarDragTargetId,
  )
  const setDragDropAction = useSidebarUIStore((s) => s.setDragDropAction)
  const dragDropAction = useSidebarUIStore((s) => s.dragDropAction)

  useEffect(() => {
    return monitorForElements({
      onDragStart: ({ source, location }) => {
        const sid = (source.data as SidebarDragData).sidebarItemId
        const draggedItem =
          (itemsMapRef.current.get(sid) ?? trashedItemsMapRef.current.get(sid)) ??
          null
        const input = location.current.input

        if (overlayRef.current) {
          overlayRef.current.style.display = ''
          overlayRef.current.style.transform = `translate(${input.clientX + 8}px, ${input.clientY + 8}px)`
        }

        lastDropTargetKeyRef.current = null
        if (draggedItem) setContent({ draggedItem, dropTarget: null })
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

          // Resolve sidebar item drop targets to their full item form
          let dropTarget: SidebarDropData | null = null
          if (rawDropTarget && 'sidebarItemId' in rawDropTarget) {
            const payload = rawDropTarget as SidebarItemDropData
            const targetItem =
              itemsMapRef.current.get(payload.sidebarItemId) ??
              trashedItemsMapRef.current.get(payload.sidebarItemId)
            if (targetItem) {
              const ancestorIds = getAncestorSidebarItemsRef
                .current(targetItem._id)
                .map((a) => a._id)
              dropTarget = { ...targetItem, ancestorIds }
            }
          } else {
            dropTarget = rawDropTarget as SidebarDropData | null
          }

          setContent((prev) => {
            if (!prev) return null
            return { ...prev, dropTarget }
          })

          let targetId: string | null = null
          if (dropTarget) {
            switch (dropTarget.type) {
              case SIDEBAR_ITEM_TYPES.notes:
              case SIDEBAR_ITEM_TYPES.folders:
              case SIDEBAR_ITEM_TYPES.gameMaps:
              case SIDEBAR_ITEM_TYPES.files:
                targetId = dropTarget._id
                break
              case SIDEBAR_ROOT_TYPE:
                targetId = SIDEBAR_ROOT_TYPE
                break
              default: // non-item types don't need to be handled here
                break
            }
          }
          setSidebarDragTargetId(targetId)

          const sid2 = (source.data as SidebarDragData).sidebarItemId
          const draggedItem =
            (itemsMapRef.current.get(sid2) ??
              trashedItemsMapRef.current.get(sid2)) ??
            null
          const action = getDragDropAction(draggedItem, dropTarget)
          setDragDropAction(action)
        }
      },
      onDrop: () => {
        if (overlayRef.current) {
          overlayRef.current.style.display = 'none'
        }
        lastDropTargetKeyRef.current = null
        setSidebarDragTargetId(null)
        setDragDropAction(null)
      },
    })
  }, [setSidebarDragTargetId, setDragDropAction])

  const dropTargetInfo = useMemo(() => {
    if (!content?.dropTarget) return null
    const { draggedItem, dropTarget } = content

    const validation = validateDrop(draggedItem, dropTarget)

    // If the drop wouldn't change anything (e.g. folder on itself), show nothing
    if (validation.valid && !wouldDropHaveEffect(draggedItem, dropTarget)) {
      return null
    }

    const rejectionReason = !validation.valid ? validation.reason : undefined
    const label = getDropLabel(dragDropAction, dropTarget, campaignName)

    if (!label && validation.valid) return null

    return {
      label,
      isValid: validation.valid,
      rejectionReason,
      action: dragDropAction,
    }
  }, [content, campaignName, dragDropAction])

  const DraggedItemIcon = content
    ? getSidebarItemIcon(content.draggedItem)
    : null
  const DraggedItemName = content ? content.draggedItem.name : ''

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed pointer-events-none z-[10000]"
      style={{ top: 0, left: 0, display: 'none' }}
    >
      {content && DraggedItemIcon && (
        <div className="bg-background rounded-sm shadow-lg shadow-foreground/25 px-2 py-1 font-semibold flex flex-col items-start w-fit opacity-70">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <DraggedItemIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate text-xs text-foreground">
              {DraggedItemName}
            </span>
          </span>
          {dropTargetInfo?.isValid ? (
            <span className="text-muted-foreground whitespace-nowrap text-xs">
              {dropTargetInfo.label}
            </span>
          ) : dropTargetInfo?.rejectionReason ? (
            <span className="text-destructive whitespace-nowrap text-xs flex items-center gap-1">
              <Ban className="w-3 h-3" />
              {rejectionReasonMessage(dropTargetInfo.rejectionReason)}
            </span>
          ) : null}
        </div>
      )}
    </div>,
    document.body,
  )
}

export function SidebarDndWrapper({ children }: { children: React.ReactNode }) {
  const { campaign, campaignId } = useCampaign()
  const campaignData = campaign.data

  const { navigateToItem } = useEditorNavigationContext()
  const { moveItem } = useSidebarItemMutations()
  const { handleDrop: handleDropFiles } = useFileDropHandler()
  const { itemsMap, getAncestorSidebarItems } = useAllSidebarItems()
  const { itemsMap: trashedItemsMap } = useTrashedSidebarItems()

  const setFolderState = useSidebarUIStore((s) => s.setFolderState)
  const setFileDragHoveredId = useSidebarUIStore((s) => s.setFileDragHoveredId)
  const setIsDraggingFiles = useSidebarUIStore((s) => s.setIsDraggingFiles)

  // Prevent the browser from opening dragged files in a new tab.
  // Using capture phase so this fires BEFORE element bubble listeners,
  // letting registered drop targets override dropEffect to 'copy'.
  useEffect(() => {
    const isFileDrag = (e: DragEvent) => {
      if (!e.dataTransfer) return false
      for (const type of e.dataTransfer.types) {
        if (type === 'Files') return true
      }
      return false
    }
    const handleDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
    }
    const handleDrop = (e: DragEvent) => {
      if (isFileDrag(e)) e.preventDefault()
    }
    document.addEventListener('dragover', handleDragOver, true)
    document.addEventListener('drop', handleDrop, true)
    return () => {
      document.removeEventListener('dragover', handleDragOver, true)
      document.removeEventListener('drop', handleDrop, true)
    }
  }, [])

  useEffect(() => {
    return monitorForElements({
      onDrop: async ({ source, location }) => {
        const dropTargets = location.current.dropTargets
        const topTarget = dropTargets[0]
        if (!topTarget) return

        const dragSid = (source.data as SidebarDragData).sidebarItemId
        const draggedItem =
          (itemsMap.get(dragSid) ?? trashedItemsMap.get(dragSid)) ?? null
        if (!draggedItem) return

        // Resolve the drop target: sidebar item payloads need full item + fresh ancestorIds
        let targetData: SidebarDropData | null = null
        if ('sidebarItemId' in topTarget.data) {
          const payload = topTarget.data as SidebarItemDropData
          const targetItem =
            itemsMap.get(payload.sidebarItemId) ??
            trashedItemsMap.get(payload.sidebarItemId)
          if (targetItem) {
            const ancestorIds = getAncestorSidebarItems(targetItem._id).map(
              (a) => a._id,
            )
            targetData = { ...targetItem, ancestorIds }
          }
        } else {
          targetData = topTarget.data as SidebarDropData
        }
        if (!targetData) return

        const action = getDragDropAction(draggedItem, targetData)

        // Empty editor drops navigate, not move
        if (targetData.type === EMPTY_EDITOR_DROP_TYPE) {
          navigateToItem(draggedItem, true)
          return
        }

        // Map drops are handled by the map component
        if (action === 'pin') return

        if (!validateDrop(draggedItem, targetData).valid) return
        if (!wouldDropHaveEffect(draggedItem, targetData)) return

        const targetId =
          targetData.type === SIDEBAR_ITEM_TYPES.folders
            ? targetData._id
            : undefined

        // Compute move options from action
        const deleted =
          action === 'trash' ? true : action === 'restore' ? false : undefined

        try {
          await moveItem(draggedItem, {
            parentId: targetId,
            deleted,
          })

          if (action === 'trash') {
            toast.success('Moved to trash')
          } else if (action === 'restore') {
            toast.success('Item restored')
          }

          if (targetId && campaignId) {
            setFolderState(campaignId, targetId, true)
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to move item'
          toast.error(message)
        }
      },
    })
  }, [
    itemsMap,
    trashedItemsMap,
    getAncestorSidebarItems,
    moveItem,
    setFolderState,
    campaignId,
    navigateToItem,
  ])

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
        if (!target || !campaignId) return
        const rawParentId = target.data.parentId
        const parentId =
          typeof rawParentId === 'string'
            ? (rawParentId as Id<'folders'>)
            : undefined
        try {
          const dropResult = await processDataTransferItems(source.items)
          if (
            dropResult.files.length > 0 ||
            dropResult.rootFolders.length > 0
          ) {
            await handleDropFiles(dropResult, { campaignId, parentId })
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to upload files'
          toast.error(message)
        }
      },
    })
  }, [setIsDraggingFiles, setFileDragHoveredId, campaignId, handleDropFiles])

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">{children}</div>
      <ClientOnly fallback={null}>
        <DragOverlay campaignName={campaignData?.name} />
      </ClientOnly>
    </>
  )
}
