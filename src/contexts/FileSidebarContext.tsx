import type { Id } from 'convex/_generated/dataModel'
import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
  type AnySidebarItem,
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
  type DropData,
} from '~/routes/_authed/campaigns/$dmUsername.$campaignSlug/notes/-components/editor/file-sidebar/dnd-utils'
import { useFolderActions } from '~/hooks/useFolderActions'

type FileSidebarContextType = {
  setRenamingId: (id: Id<'folders'> | Id<'notes'> | null) => void
  renamingId: Id<'folders'> | Id<'notes'> | null
  setDeletingId: (id: Id<'folders'> | Id<'notes'> | null) => void
  deletingId: Id<'folders'> | Id<'notes'> | null

  folderStates: Record<string, boolean>
  setFolderState: (folderId: string, isOpen: boolean) => void
  openFolder: (folderId: string) => void
  closeFolder: (folderId: string) => void
  activeDragItem: AnySidebarItem | null
}

const FileSidebarContext = createContext<FileSidebarContextType | null>(null)

export function FileSidebarProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [renamingId, setRenamingId] = useState<
    Id<'folders'> | Id<'notes'> | null
  >(null)
  const [deletingId, setDeletingId] = useState<
    Id<'folders'> | Id<'notes'> | null
  >(null)

  const [folderStates, setFolderStates] = usePersistedState<
    Record<string, boolean>
  >('file-sidebar-folder-states', {})

  const { moveFolder } = useFolderActions()
  const { moveNote } = useNoteActions()

  const [activeDragItem, setActiveDragItem] = useState<AnySidebarItem | null>(
    null,
  )

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

      const draggedItem = active.data.current as AnySidebarItem
      const targetData = over.data.current as DropData

      if (draggedItem.type === SIDEBAR_ITEM_TYPES.notes) {
        let parentFolderId: Id<'folders'> | undefined = undefined

        if (targetData.type !== SIDEBAR_ROOT_TYPE) {
          parentFolderId = over.id as Id<'folders'>
          openFolder(parentFolderId)
        }

        await moveNote.mutateAsync({ noteId: draggedItem._id, parentFolderId })
      }

      if (draggedItem.type === SIDEBAR_ITEM_TYPES.folders) {
        let parentId: Id<'folders'> | undefined = undefined
        if (targetData.type !== SIDEBAR_ROOT_TYPE) {
          parentId = over.id as Id<'folders'>
          openFolder(parentId)
        }

        await moveFolder.mutateAsync({
          folderId: draggedItem._id,
          parentId: parentId,
        })
      }
    },
    [moveNote, moveFolder, openFolder],
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
