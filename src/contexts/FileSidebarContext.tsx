import type { Id } from 'convex/_generated/dataModel'
import {
  SIDEBAR_ROOT_TYPE,
  type AnySidebarItem,
  type SidebarItemType,
} from 'convex/notes/types'
import { createContext, useCallback, useContext, useState } from 'react'
import usePersistedState from '~/hooks/usePersistedState'
import { useNoteActions } from '~/hooks/useNoteActions'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  canDropItem,
  type SidebarDragData,
  type SidebarDropData,
} from '~/routes/_authed/campaigns/$dmUsername.$campaignSlug/notes/-components/editor/file-sidebar/dnd-utils'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { executeMove } from '~/utils/dnd-utils'

type FileSidebarContextType = {
  setRenamingId: (id: Id<SidebarItemType> | null) => void
  renamingId: Id<SidebarItemType> | null
  setDeletingId: (id: Id<SidebarItemType> | null) => void
  deletingId: Id<SidebarItemType> | null

  folderStates: Record<Id<'folders'>, boolean>
  setFolderState: (folderId: Id<'folders'>, isOpen: boolean) => void
  openFolder: (folderId: Id<'folders'>) => void
  closeFolder: (folderId: Id<'folders'>) => void
  activeDragItem: SidebarDragData | null
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
    Record<Id<'folders'>, boolean>
  >('file-sidebar-folder-states', {})

  const { moveFolder } = useFolderActions()
  const { moveNote } = useNoteActions()

  const moveMap = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.moveMap),
  })

  const [activeDragItem, setActiveDragItem] = useState<SidebarDragData | null>(
    null,
  )

  const setFolderState = useCallback(
    (folderId: Id<'folders'>, isOpen: boolean) => {
      setFolderStates((prev) => ({
        ...prev,
        [folderId]: isOpen,
      }))
    },
    [setFolderStates],
  )

  const openFolder = useCallback(
    (folderId: Id<'folders'>) => {
      setFolderState(folderId, true)
    },
    [setFolderState],
  )

  const closeFolder = useCallback(
    (folderId: Id<'folders'>) => {
      setFolderState(folderId, false)
    },
    [setFolderState],
  )

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
    const item = active.data.current as AnySidebarItem
    if (item) {
      setActiveDragItem(item)
    }
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveDragItem(null)

      if (!active.data.current || !over) return

      // Validate the drop using shared utility
      if (!canDropItem(active, over)) return

      const draggedItem = active.data.current as SidebarDragData
      const targetData = over.data.current as SidebarDropData

      if (!targetData) return

      const targetId =
        targetData._id === SIDEBAR_ROOT_TYPE
          ? undefined
          : (targetData._id as Id<'folders'>)

      await executeMove(
        draggedItem.type,
        draggedItem._id,
        targetId,
        {
          moveNote: (params) => moveNote.mutateAsync(params),
          moveFolder: (params) => moveFolder.mutateAsync(params),
          moveMap: (params) => moveMap.mutateAsync(params),
        },
        {
          openFolder,
        },
      )
    },
    [moveNote, moveFolder, moveMap, openFolder],
  )

  const handleDragCancel = useCallback(() => {
    setActiveDragItem(null)
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
    activeDragItem,
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
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
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
