import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDndContext,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { getEventCoordinates } from '@dnd-kit/utilities'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { SIDEBAR_ROOT_TYPE } from 'convex/sidebarItems/types'
import type { DragEndEvent, DragStartEvent, Modifier } from '@dnd-kit/core'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import type { FileSidebarContextType } from '~/hooks/useFileSidebar'
import type { SidebarDragData, SidebarDropData } from '~/lib/dnd-utils'
import { useNoteActions } from '~/hooks/useNoteActions'
import {
  EMPTY_EDITOR_DROP_TYPE,
  canDropItem,
  executeMove,
  isMapDropZone,
  isSidebarItem,
  wouldMoveChangePosition,
} from '~/lib/dnd-utils'
import { useFolderActions } from '~/hooks/useFolderActions'
import usePersistedState from '~/hooks/usePersistedState'
import { FileSidebarContext } from '~/hooks/useFileSidebar'
import { MouseSensor, TouchSensor } from '~/lib/dnd-sensors'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { useSidebarItemValidation } from '~/hooks/useSidebarItemValidation'
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
    const isValidDrop = canDropItem(active, over)
    const wouldChange = wouldMoveChangePosition(draggedItem, targetData)

    // Get target info for display
    if (isMapDropZone(targetData)) {
      return {
        name: targetData.mapName,
        isValid: isValidDrop,
        wouldChange,
        action: 'pin' as const,
      }
    } else if (isSidebarItem(targetData)) {
      return {
        name: targetData.name || defaultItemName(targetData as AnySidebarItem),
        isValid: isValidDrop,
        wouldChange,
        action: 'move' as const,
      }
    } else if (targetData.type === SIDEBAR_ROOT_TYPE) {
      return {
        name: campaign?.name || 'root',
        isValid: isValidDrop,
        wouldChange,
        action: 'move' as const,
      }
    }

    return isValidDrop
      ? null
      : {
          name: null,
          isValid: false,
          wouldChange: false,
          action: 'move' as const,
        }
  }, [active, over, campaign])

  return (
    <div className="bg-background rounded-sm shadow-lg shadow-foreground/25 px-2 py-1 font-semibold flex flex-col items-left animate-overlay-shrink w-fit max-w-full opacity-70 ">
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
      ) : dropTargetInfo && !dropTargetInfo.isValid ? (
        <span className="text-destructive whitespace-nowrap text-xs flex items-center gap-1">
          <Ban className="w-3 h-3" />
          Cannot drop here
        </span>
      ) : null}
    </div>
  )
}

export function FileSidebarProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const [renamingId, setRenamingId] = useState<SidebarItemId | null>(null)
  const [deletingId, setDeletingId] = useState<SidebarItemId | null>(null)

  const [folderStates, setFolderStates] = usePersistedState<
    Record<string, boolean>
  >(campaignId ? `file-sidebar-folder-states-${campaignId}` : null, {})

  const [closeAllFoldersMode, setCloseAllFoldersMode] =
    usePersistedState<boolean>(
      campaignId ? `file-sidebar-close-all-folders-mode-${campaignId}` : null,
      false,
    )

  const [bookmarksOnlyMode, setBookmarksOnlyMode] = usePersistedState<boolean>(
    campaignId ? `file-sidebar-bookmarks-mode-${campaignId}` : null,
    false,
  )

  const { moveNote } = useNoteActions()
  const { moveFolder } = useFolderActions()
  const { navigateToItem } = useEditorNavigation()
  const { validateNameConflictSync, canMoveToParent } =
    useSidebarItemValidation()

  const moveMap = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.moveMap),
  })

  const moveFile = useMutation({
    mutationFn: useConvexMutation(api.files.mutations.moveFile),
  })

  const [activeDragItem, setActiveDragItem] = useState<SidebarDragData | null>(
    null,
  )

  const [fileDragHoveredId, setFileDragHoveredId] =
    useState<SidebarItemId | null>(null)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)

  const setFolderState = useCallback(
    (folderId: string, isOpen: boolean) => {
      setFolderStates((prev) => ({
        ...prev,
        [folderId]: isOpen,
      }))
    },
    [setFolderStates],
  )

  const toggleFolderState = useCallback(
    (folderId: string) => {
      setFolderStates((prev) => ({
        ...prev,
        [folderId]: !(prev[folderId] ?? false),
      }))
    },
    [setFolderStates],
  )

  const openFolder = useCallback(
    (folderId: string) => {
      setFolderState(folderId, true)
    },
    [setFolderState],
  )

  const closeFolder = useCallback(
    (folderId: string) => {
      setFolderState(folderId, false)
    },
    [setFolderState],
  )

  const clearAllFolderStates = useCallback(() => {
    setFolderStates({})
  }, [setFolderStates])

  const toggleCloseAllFoldersMode = useCallback(() => {
    setCloseAllFoldersMode((prev) => !prev)
  }, [setCloseAllFoldersMode])

  const exitCloseAllMode = useCallback(() => {
    setCloseAllFoldersMode(false)
  }, [setCloseAllFoldersMode])

  const toggleBookmarksOnlyMode = useCallback(() => {
    setBookmarksOnlyMode((prev) => !prev)
  }, [setBookmarksOnlyMode])

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const item = active.data.current as SidebarDragData | null | undefined
    if (item) {
      setActiveDragItem(item)
    }
  }, [])

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

      const targetId = isSidebarItem(targetData) ? targetData._id : undefined

      if (draggedItem._id === targetId) {
        return
      }

      // Validate circular parent reference
      if (!canMoveToParent(draggedItem._id, targetId)) {
        toast.error('Cannot move item into its own descendant')
        return
      }

      // Validate name conflict in target location
      const nameConflictResult = validateNameConflictSync(
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

      await executeMove(
        draggedItem.type,
        draggedItem._id,
        targetId,
        {
          moveNote: (params) => moveNote.mutateAsync(params),
          moveMap: (params) => moveMap.mutateAsync(params),
          moveFolder: (params) => moveFolder.mutateAsync(params),
          moveFile: (params) => moveFile.mutateAsync(params),
        },
        {
          openFolder: (id) => openFolder(id),
        },
      ).catch((error: Error) => {
        console.error('Failed to move item:', error)
        toast.error('Failed to move item')
      })
    },
    [
      moveNote,
      moveMap,
      moveFolder,
      openFolder,
      moveFile,
      navigateToItem,
      canMoveToParent,
      validateNameConflictSync,
    ],
  )

  const handleDragCancel = useCallback(() => {
    setActiveDragItem(null)
  }, [])

  const value: FileSidebarContextType = useMemo(
    () => ({
      renamingId,
      setRenamingId,
      deletingId,
      setDeletingId,
      folderStates,
      setFolderState,
      toggleFolderState,
      openFolder,
      closeFolder,
      clearAllFolderStates,
      activeDragItem,
      closeAllFoldersMode,
      toggleCloseAllFoldersMode,
      exitCloseAllMode,
      fileDragHoveredId,
      setFileDragHoveredId,
      isDraggingFiles,
      setIsDraggingFiles,
      bookmarksOnlyMode,
      toggleBookmarksOnlyMode,
    }),
    [
      renamingId,
      setRenamingId,
      deletingId,
      setDeletingId,
      folderStates,
      setFolderState,
      toggleFolderState,
      openFolder,
      closeFolder,
      clearAllFolderStates,
      activeDragItem,
      closeAllFoldersMode,
      toggleCloseAllFoldersMode,
      exitCloseAllMode,
      fileDragHoveredId,
      setFileDragHoveredId,
      isDraggingFiles,
      setIsDraggingFiles,
      bookmarksOnlyMode,
      toggleBookmarksOnlyMode,
    ],
  )

  return (
    <FileSidebarContext.Provider value={value}>
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
    </FileSidebarContext.Provider>
  )
}
