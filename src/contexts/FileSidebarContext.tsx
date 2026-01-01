import { SIDEBAR_ROOT_TYPE } from 'convex/sidebarItems/types'
import { useCallback, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { SidebarItemType } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSidebarContextType } from '~/hooks/useFileSidebar'
import type { SidebarDragData, SidebarDropData } from '~/lib/dnd-utils'
import { useNoteActions } from '~/hooks/useNoteActions'
import { canDropItem, executeMove } from '~/lib/dnd-utils'
import { useTagActions } from '~/hooks/useTagActions'
import { useFolderActions } from '~/hooks/useFolderActions'
import usePersistedState from '~/hooks/usePersistedState'
import { FileSidebarContext } from '~/hooks/useFileSidebar'
import { MouseSensor, TouchSensor } from '~/lib/dnd-sensors'

export function FileSidebarProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [renamingId, setRenamingId] = useState<Id<SidebarItemType> | null>(null)
  const [deletingId, setDeletingId] = useState<Id<SidebarItemType> | null>(null)

  const [folderStates, setFolderStates] = usePersistedState<
    Record<string, boolean>
  >('file-sidebar-folder-states', {})

  const [closeAllFoldersMode, setCloseAllFoldersMode] =
    usePersistedState<boolean>('file-sidebar-close-all-folders-mode', false)

  const { moveNote } = useNoteActions()
  const { moveFolder } = useFolderActions()
  const { moveTag } = useTagActions()

  const moveMap = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.moveMap),
  })

  const [activeDragItem, setActiveDragItem] = useState<SidebarDragData | null>(
    null,
  )
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 })
  const pointerListenerRef = useRef<(() => void) | null>(null)

  const setFolderState = useCallback(
    (folderId: string, isOpen: boolean) => {
      setFolderStates((prev) => ({
        ...prev,
        [folderId]: isOpen,
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

      // Set up pointer tracking for drag overlay
      if (pointerListenerRef.current) {
        pointerListenerRef.current()
      }

      const handlePointerMove = (e: globalThis.PointerEvent) => {
        setPointerOffset({ x: e.clientX, y: e.clientY })
      }

      document.addEventListener('pointermove', handlePointerMove)

      pointerListenerRef.current = () => {
        document.removeEventListener('pointermove', handlePointerMove)
      }
    }
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveDragItem(null)
      setPointerOffset({ x: 0, y: 0 })

      if (pointerListenerRef.current) {
        pointerListenerRef.current()
        pointerListenerRef.current = null
      }

      if (!active.data.current || !over) return

      // Validate the drop using shared utility
      if (!canDropItem(active, over)) return

      const draggedItem = active.data.current as SidebarDragData
      const targetData = over.data.current as SidebarDropData

      const targetId =
        targetData._id === SIDEBAR_ROOT_TYPE
          ? undefined
          : (targetData._id as
              | Id<'notes'>
              | Id<'folders'>
              | Id<'tagCategories'>
              | Id<'tags'>)

      await executeMove(
        draggedItem.type,
        draggedItem._id,
        targetId,
        {
          moveNote: (params) => moveNote.mutateAsync(params),
          moveMap: (params) => moveMap.mutateAsync(params),
          moveFolder: (params) => moveFolder.mutateAsync(params),
          moveTag: (params) => moveTag.mutateAsync(params),
        },
        {
          openFolder: (id) => openFolder(id),
        },
      ).catch((error: Error) => {
        console.error('Failed to move item:', error)
        toast.error('Failed to move item')
      })
    },
    [moveNote, moveMap, moveFolder, moveTag, openFolder],
  )

  const handleDragCancel = useCallback(() => {
    // Clean up pointer listener
    if (pointerListenerRef.current) {
      pointerListenerRef.current()
      pointerListenerRef.current = null
    }
    setActiveDragItem(null)
    setPointerOffset({ x: 0, y: 0 })
  }, [])

  const value: FileSidebarContextType = {
    renamingId,
    setRenamingId,
    deletingId,
    setDeletingId,
    folderStates,
    setFolderState,
    openFolder,
    closeFolder,
    clearAllFolderStates,
    activeDragItem,
    closeAllFoldersMode,
    toggleCloseAllFoldersMode,
    exitCloseAllMode,
  }

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
          dropAnimation={null}
          className="flex items-center justify-center pointer-events-none"
          style={{
            position: 'fixed',
            left: `${pointerOffset.x}px`,
            top: `${pointerOffset.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {activeDragItem && (
            <div className="h-6 bg-background rounded-sm shadow-lg p-2 flex items-center justify-center gap-1 animate-overlay-shrink">
              <activeDragItem.icon className="w-5 h-5" />
              <span className="text-sm text-foreground font-semibold">
                {activeDragItem.name}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </FileSidebarContext.Provider>
  )
}
