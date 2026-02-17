import { useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDndContext,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { getEventCoordinates } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/baseTypes'
import type { DragEndEvent, DragStartEvent, Modifier } from '@dnd-kit/core'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type {
  DropRejectionReason,
  SidebarDragData,
  SidebarDropData,
} from '~/lib/dnd-utils'
import type { Id } from 'convex/_generated/dataModel'
import {
  EMPTY_EDITOR_DROP_TYPE,
  canDropItem,
  getDropValidation,
  isMapDropZone,
  isSidebarItem,
  wouldMoveChangePosition,
} from '~/lib/dnd-utils'
import { MouseSensor, TouchSensor } from '~/lib/dnd-sensors'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigationContext } from '~/contexts/EditorNavigationProvider'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { Ban } from '~/lib/icons'

const snapTopLeftToCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (draggingNodeRect && activatorEvent) {
    const activatorCoordinates = getEventCoordinates(activatorEvent)

    if (!activatorCoordinates) {
      return transform
    }

    const offsetX = activatorCoordinates.x - draggingNodeRect.left
    const offsetY = activatorCoordinates.y - draggingNodeRect.top

    return {
      ...transform,
      x: transform.x + offsetX,
      y: transform.y + offsetY,
    }
  }

  return transform
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
  }
}

function DragOverlayContent({
  activeDragItem,
}: {
  activeDragItem: SidebarDragData
}) {
  const { active, over } = useDndContext()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign

  const DraggedItemIcon = getSidebarItemIcon(activeDragItem as AnySidebarItem)
  const DraggedItemName =
    activeDragItem.name || defaultItemName(activeDragItem as AnySidebarItem)

  const dropTargetInfo = useMemo(() => {
    if (!active || !over || !active.data.current) {
      return null
    }

    const draggedItem = active.data.current as SidebarDragData
    const targetData = over.data.current as SidebarDropData
    const validation = getDropValidation(active, over)
    const wouldChange = wouldMoveChangePosition(draggedItem, targetData)
    const rejectionReason = !validation.valid ? validation.reason : undefined

    // Get target info for display
    if (isMapDropZone(targetData)) {
      return {
        name: targetData.mapName,
        isValid: validation.valid,
        wouldChange,
        rejectionReason,
        action: 'pin' as const,
      }
    } else if (isSidebarItem(targetData)) {
      return {
        name: targetData.name || defaultItemName(targetData as AnySidebarItem),
        isValid: validation.valid,
        wouldChange,
        rejectionReason,
        action: 'move' as const,
      }
    } else if (targetData.type === SIDEBAR_ROOT_TYPE) {
      return {
        name: campaign?.name || 'root',
        isValid: validation.valid,
        wouldChange,
        rejectionReason,
        action: 'move' as const,
      }
    }

    return validation.valid
      ? null
      : {
          name: null,
          isValid: false,
          wouldChange: false,
          rejectionReason,
          action: 'move' as const,
        }
  }, [active, over, campaign])

  return (
    <div className="bg-background rounded-sm shadow-lg shadow-foreground/25 px-2 py-1 font-semibold flex flex-col items-left animate-overlay-shrink w-fit opacity-70">
      <span className="flex items-center gap-1 whitespace-nowrap">
        <DraggedItemIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="truncate text-xs text-foreground">
          {DraggedItemName}
        </span>
      </span>
      {dropTargetInfo?.isValid && dropTargetInfo.wouldChange ? (
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
  )
}

export function SidebarDndWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const { navigateToItem } = useEditorNavigationContext()
  const { canMoveToParent, validateName, move } = useSidebarItemMutations()

  const activeDragItem = useSidebarUIStore((s) => s.activeDragItem)
  const setActiveDragItem = useSidebarUIStore((s) => s.setActiveDragItem)
  const setFolderState = useSidebarUIStore((s) => s.setFolderState)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      const item = active.data.current as SidebarDragData | null | undefined
      if (item) {
        setActiveDragItem(item)
      }
    },
    [setActiveDragItem],
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveDragItem(null)

      if (!active.data.current || !over) return

      const draggedItem = active.data.current as SidebarDragData
      const targetData = over.data.current as SidebarDropData

      // Map drop zones are handled by the map viewer via useDndMonitor
      if (isMapDropZone(targetData)) {
        return
      }

      // If dropping on empty editor, open the item instead of moving it
      if (targetData.type === EMPTY_EDITOR_DROP_TYPE) {
        navigateToItem(draggedItem as AnySidebarItem, true)
        return
      }

      if (!canDropItem(active, over)) return

      const targetId =
        isSidebarItem(targetData) &&
        targetData.type === SIDEBAR_ITEM_TYPES.folders
          ? (targetData._id as Id<'folders'>)
          : undefined

      if (draggedItem._id === targetId) {
        return
      }

      // Validate circular parent reference
      if (!canMoveToParent(draggedItem._id, targetId)) {
        toast.error('Cannot move item into its own descendant')
        return
      }

      // Validate name conflict in target location
      const nameConflictResult = validateName(
        draggedItem.name,
        targetId,
        draggedItem._id,
      )
      if (!nameConflictResult.valid) {
        toast.error(
          nameConflictResult.error ??
            'An item with this name already exists here',
        )
        return
      }

      try {
        // Optimistic move via collection
        move(draggedItem as AnySidebarItem, targetId)

        // Open the target folder so the moved item is visible
        if (targetId && campaignId) {
          setFolderState(campaignId, targetId, true)
        }
      } catch (error) {
        console.error('Failed to move item:', error)
        toast.error('Failed to move item')
      }
    },
    [
      move,
      setFolderState,
      campaignId,
      navigateToItem,
      canMoveToParent,
      validateName,
      setActiveDragItem,
    ],
  )

  const handleDragCancel = useCallback(() => {
    setActiveDragItem(null)
  }, [setActiveDragItem])

  return (
    <DndContext
      autoScroll={{
        threshold: {
          x: 0,
          y: 0.25,
        },
      }}
      collisionDetection={pointerWithin}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay
        modifiers={[snapTopLeftToCursor]}
        dropAnimation={null}
        className="pointer-events-none inline-block"
      >
        {activeDragItem && (
          <DragOverlayContent activeDragItem={activeDragItem} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
