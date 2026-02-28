import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ClientOnly } from '@tanstack/react-router'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { toast } from 'sonner'
import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type {
  DragDropAction,
  DropRejectionReason,
  SidebarDragData,
  SidebarDropData,
} from '~/lib/dnd-utils'
import type { Id } from 'convex/_generated/dataModel'
import {
  EMPTY_EDITOR_DROP_TYPE,
  getDragDropAction,
  isMapDropZone,
  isSidebarItem,
  isTrashDropZone,
  validateDrop,
  wouldMoveChangePosition,
} from '~/lib/dnd-utils'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigationContext } from '~/hooks/useEditorNavigationContext'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { Ban } from '~/lib/icons'

function getActionVerb(action: DragDropAction): string {
  switch (action) {
    case 'restore':
      return 'Restore to'
    case 'pin':
      return 'Pin to'
    default:
      return 'Move to'
  }
}

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
    case 'missing_data':
      return 'Missing data'
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
  const setDragDropAction = useSidebarUIStore((s) => s.setDragDropAction)

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
      onDrag: ({ location, source }) => {
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

          const action = getDragDropAction(
            source.data as SidebarDragData,
            dropTarget,
          )
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
    const { dragData, dropTarget } = content

    const validation = validateDrop(dragData, dropTarget)
    const action = getDragDropAction(dragData, dropTarget)

    // If the drop wouldn't change anything (e.g. folder on itself), show nothing
    if (validation.valid && !wouldMoveChangePosition(dragData, dropTarget)) {
      return null
    }

    const rejectionReason = !validation.valid ? validation.reason : undefined

    // Determine the target name for overlay text
    let name: string | null = null
    if (isTrashDropZone(dropTarget)) {
      name = 'Trash'
    } else if (isMapDropZone(dropTarget)) {
      name = dropTarget.mapName
    } else if (isSidebarItem(dropTarget)) {
      name = dropTarget.name
    } else if (dropTarget.type === SIDEBAR_ROOT_TYPE) {
      name = campaignName || 'root'
    }

    if (!name && validation.valid) return null

    return { name, isValid: validation.valid, rejectionReason, action }
  }, [content, campaignName])

  const DraggedItemIcon = content
    ? getSidebarItemIcon(content.dragData as AnySidebarItem)
    : null
  const DraggedItemName = content ? content.dragData.name : ''

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
              {dropTargetInfo.action === 'move-and-trash'
                ? 'Move to "Trash"'
                : `${getActionVerb(dropTargetInfo.action)} "${dropTargetInfo.name}"`}
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

  const setFolderState = useSidebarUIStore((s) => s.setFolderState)

  useEffect(() => {
    return monitorForElements({
      onDrop: async ({ source, location }) => {
        const dropTargets = location.current.dropTargets
        const topTarget = dropTargets[0]
        if (!topTarget) return

        const draggedItem = source.data as SidebarDragData
        const targetData = topTarget.data as SidebarDropData

        const action = getDragDropAction(draggedItem, targetData)

        // Empty editor drops navigate, not move
        if (targetData.type === EMPTY_EDITOR_DROP_TYPE) {
          navigateToItem(draggedItem as AnySidebarItem, true)
          return
        }

        // Map drops are handled by the map component
        if (action === 'pin') return

        if (!validateDrop(draggedItem, targetData).valid) return
        if (!wouldMoveChangePosition(draggedItem, targetData)) return

        const targetId =
          isSidebarItem(targetData) &&
          targetData.type === SIDEBAR_ITEM_TYPES.folders
            ? (targetData._id as Id<'folders'>)
            : undefined

        // Compute move options from action
        const deleted =
          action === 'trash' || action === 'move-and-trash'
            ? true
            : action === 'restore'
              ? false
              : undefined

        try {
          await moveItem(draggedItem as AnySidebarItem, {
            parentId: targetId,
            deleted,
          })

          if (action === 'trash' || action === 'move-and-trash') {
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
  }, [moveItem, setFolderState, campaignId, navigateToItem])

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">{children}</div>
      <ClientOnly fallback={null}>
        <DragOverlay campaignName={campaignData?.name} />
      </ClientOnly>
    </>
  )
}
