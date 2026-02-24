import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ClientOnly } from '@tanstack/react-router'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { toast } from 'sonner'
import { defaultItemName } from 'convex/sidebarItems/functions/defaultItemName'
import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type {
  DropRejectionReason,
  SidebarDragData,
  SidebarDropData,
} from '~/lib/dnd-utils'
import type { Id } from 'convex/_generated/dataModel'
import {
  EMPTY_EDITOR_DROP_TYPE,
  isMapDropZone,
  isSidebarItem,
  validateDrop,
  wouldMoveChangePosition,
} from '~/lib/dnd-utils'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigationContext } from '~/hooks/useEditorNavigationContext'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { Ban } from '~/lib/icons'

function rejectionReasonMessage(reason: DropRejectionReason): string {
  switch (reason) {
    case 'no_permission':
      return 'No permission to move here'
    case 'circular':
      return 'Cannot move folder into itself'
    case 'self_pin':
      return 'Cannot pin map to itself'
    case 'not_folder':
      return 'Cannot drop here'
  }
}

interface OverlayContentState {
  dragData: SidebarDragData
  dropTarget: SidebarDropData | null
}

/** Get a stable key for a drop target to avoid unnecessary re-renders */
function getDropTargetKey(target: SidebarDropData | null): string | null {
  if (!target) return null
  if (isSidebarItem(target)) return target._id
  if (isMapDropZone(target)) return `map:${target.mapId}`
  return target.type
}

function DragOverlay({ campaignName }: { campaignName: string | undefined }) {
  const [content, setContent] = useState<OverlayContentState | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const lastDropTargetKeyRef = useRef<string | null>(null)

  const setSidebarDragTargetId = useSidebarUIStore(
    (s) => s.setSidebarDragTargetId,
  )

  useEffect(() => {
    return monitorForElements({
      onDragStart: ({ source, location }) => {
        const dragData = source.data as SidebarDragData
        const input = location.current.input

        if (overlayRef.current) {
          overlayRef.current.style.display = ''
          overlayRef.current.style.transform = `translate(${input.clientX + 8}px, ${input.clientY + 8}px)`
        }

        lastDropTargetKeyRef.current = null
        setContent({ dragData, dropTarget: null })
      },
      onDrag: ({ location }) => {
        const input = location.current.input
        if (overlayRef.current) {
          overlayRef.current.style.transform = `translate(${input.clientX + 8}px, ${input.clientY + 8}px)`
        }

        const topTarget = location.current.dropTargets[0]
        const dropTarget = topTarget
          ? (topTarget.data as SidebarDropData)
          : null
        const key = getDropTargetKey(dropTarget)

        if (key !== lastDropTargetKeyRef.current) {
          lastDropTargetKeyRef.current = key
          setContent((prev) => {
            if (!prev) return null
            return { ...prev, dropTarget }
          })

          let targetId: string | null = null
          if (dropTarget) {
            if (isSidebarItem(dropTarget)) targetId = dropTarget._id
            else if (dropTarget.type === SIDEBAR_ROOT_TYPE)
              targetId = SIDEBAR_ROOT_TYPE
          }
          setSidebarDragTargetId(targetId)
        }
      },
      onDrop: () => {
        if (overlayRef.current) {
          overlayRef.current.style.display = 'none'
        }
        lastDropTargetKeyRef.current = null
        setSidebarDragTargetId(null)
      },
    })
  }, [setSidebarDragTargetId])

  const dropTargetInfo = useMemo(() => {
    if (!content?.dropTarget) return null
    const { dragData, dropTarget } = content

    const validation = validateDrop(dragData, dropTarget)
    const rejectionReason = !validation.valid ? validation.reason : undefined

    if (isMapDropZone(dropTarget)) {
      return {
        name: dropTarget.mapName,
        isValid: validation.valid,
        rejectionReason,
        action: 'pin' as const,
      }
    } else if (isSidebarItem(dropTarget)) {
      return {
        name: dropTarget.name || defaultItemName(dropTarget as AnySidebarItem),
        isValid: validation.valid,
        rejectionReason,
        action: 'move' as const,
      }
    } else if (dropTarget.type === SIDEBAR_ROOT_TYPE) {
      return {
        name: campaignName || 'root',
        isValid: validation.valid,
        rejectionReason,
        action: 'move' as const,
      }
    }

    return validation.valid
      ? null
      : {
          name: null,
          isValid: false,
          rejectionReason,
          action: 'move' as const,
        }
  }, [content, campaignName])

  const DraggedItemIcon = content
    ? getSidebarItemIcon(content.dragData as AnySidebarItem)
    : null
  const DraggedItemName = content
    ? content.dragData.name ||
      defaultItemName(content.dragData as AnySidebarItem)
    : ''

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
              {dropTargetInfo.action === 'pin' ? 'Pin to' : 'Move to'} &quot;
              {dropTargetInfo.name}&quot;
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
  const { move } = useSidebarItemMutations()

  const setFolderState = useSidebarUIStore((s) => s.setFolderState)

  useEffect(() => {
    return monitorForElements({
      onDrop: async ({ source, location }) => {
        const dropTargets = location.current.dropTargets
        const topTarget = dropTargets[0]
        if (!topTarget) return

        const draggedItem = source.data as SidebarDragData
        const targetData = topTarget.data as SidebarDropData

        if (isMapDropZone(targetData)) {
          return
        }

        if (targetData.type === EMPTY_EDITOR_DROP_TYPE) {
          navigateToItem(draggedItem as AnySidebarItem, true)
          return
        }

        if (!validateDrop(draggedItem, targetData).valid) return

        const targetId =
          isSidebarItem(targetData) &&
          targetData.type === SIDEBAR_ITEM_TYPES.folders
            ? (targetData._id as Id<'folders'>)
            : undefined

        if (draggedItem._id === targetId) return
        if (!wouldMoveChangePosition(draggedItem, targetData)) return

        try {
          await move(draggedItem as AnySidebarItem, targetId)

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
  }, [move, setFolderState, campaignId, navigateToItem])

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">{children}</div>
      <ClientOnly fallback={null}>
        <DragOverlay campaignName={campaignData?.name} />
      </ClientOnly>
    </>
  )
}
