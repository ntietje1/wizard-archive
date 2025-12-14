import type { Id } from 'convex/_generated/dataModel'
import {
  SIDEBAR_ROOT_TYPE,
  type SidebarItemType,
} from 'convex/sidebarItems/types'
import { createContext, useCallback, useContext, useState, useRef } from 'react'
import usePersistedState from '~/hooks/usePersistedState'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  pointerWithin,
} from '@dnd-kit/core'
import {
  canDropItem,
  type SidebarDragData,
  type SidebarDropData,
  executeMove,
} from '~/lib/dnd-utils'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useTagActions } from '~/hooks/useTagActions'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'

type FileSidebarContextType = {
  setRenamingId: (id: Id<SidebarItemType> | null) => void
  renamingId: Id<SidebarItemType> | null
  setDeletingId: (id: Id<SidebarItemType> | null) => void
  deletingId: Id<SidebarItemType> | null

  folderStates: Record<string, boolean>
  setFolderState: (folderId: string, isOpen: boolean) => void
  openFolder: (folderId: string) => void
  closeFolder: (folderId: string) => void
  clearAllFolderStates: () => void
  activeDragItem: SidebarDragData | null
  closeAllFoldersMode: boolean
  toggleCloseAllFoldersMode: () => void
  exitCloseAllMode: () => void
}

const FileSidebarContext = createContext<FileSidebarContextType | null>(null)

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
    const item = active.data.current as SidebarDragData
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

      if (!targetData) return

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
          {activeDragItem ? (
            <div className="h-6 bg-background rounded-sm shadow-lg p-2 flex items-center justify-center gap-1 animate-overlay-shrink">
              {activeDragItem.icon && (
                <activeDragItem.icon className="w-5 h-5" />
              )}
              <span className="text-sm text-foreground font-semibold">
                {activeDragItem.name}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </FileSidebarContext.Provider>
  )
}

export const useFileSidebar = () => {
  const context = useContext(FileSidebarContext)
  if (!context) {
    throw new Error('useFileSidebar must be used within a FileSidebarProvider')
  }
  return context
}
