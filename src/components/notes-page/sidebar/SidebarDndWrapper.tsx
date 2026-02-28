import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ClientOnly } from '@tanstack/react-router'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { toast } from 'sonner'
import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/types/baseTypes'
import type {
  DropRejectionReason,
  SidebarDragData,
  SidebarDropData,
} from '~/lib/dnd-utils'
import {
  EMPTY_EDITOR_DROP_TYPE,
  MAP_DROP_ZONE_TYPE,
  TRASH_DROP_ZONE_TYPE,
  getDragDropAction,
  getDropLabel,
  validateDrop,
  wouldMoveChangePosition,
} from '~/lib/dnd-utils'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigationContext } from '~/hooks/useEditorNavigationContext'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { Ban } from '~/lib/icons'
import { assertNever } from '~/lib/utils'

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
    default:
      return assertNever(reason)
  }
}

interface OverlayContentState {
  dragData: SidebarDragData
  dropTarget: SidebarDropData | null
}

/** Get a stable key for a drop target to avoid unnecessary re-renders */
function getDropTargetKey(target: SidebarDropData | null): string | null {
  if (!target) return null
  switch (target.type) {
    case SIDEBAR_ITEM_TYPES.notes:
    case SIDEBAR_ITEM_TYPES.folders:
    case SIDEBAR_ITEM_TYPES.gameMaps:
    case SIDEBAR_ITEM_TYPES.files:
      return target._id
    case MAP_DROP_ZONE_TYPE:
      return `map:${target.mapId}`
    case TRASH_DROP_ZONE_TYPE:
    case EMPTY_EDITOR_DROP_TYPE:
    case SIDEBAR_ROOT_TYPE:
      return target.type
    default:
      return assertNever(target)
  }
}

function DragOverlay({ campaignName }: { campaignName: string | undefined }) {
  const [content, setContent] = useState<OverlayContentState | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const lastDropTargetKeyRef = useRef<string | null>(null)

  const setSidebarDragTargetId = useSidebarUIStore(
    (s) => s.setSidebarDragTargetId,
  )
  const setDragDropAction = useSidebarUIStore((s) => s.setDragDropAction)
  const dragDropAction = useSidebarUIStore((s) => s.dragDropAction)

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

    // If the drop wouldn't change anything (e.g. folder on itself), show nothing
    if (validation.valid && !wouldMoveChangePosition(dragData, dropTarget)) {
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

  const DraggedItemIcon = content ? getSidebarItemIcon(content.dragData) : null
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
          navigateToItem(draggedItem, true)
          return
        }

        // Map drops are handled by the map component
        if (action === 'pin') return

        if (!validateDrop(draggedItem, targetData).valid) return
        if (!wouldMoveChangePosition(draggedItem, targetData)) return

        const targetId =
          targetData.type === SIDEBAR_ITEM_TYPES.folders
            ? targetData._id
            : undefined

        // Compute move options from action
        const deleted =
          action === 'trash' || action === 'move-and-trash'
            ? true
            : action === 'restore'
              ? false
              : undefined

        try {
          await moveItem(draggedItem, {
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
