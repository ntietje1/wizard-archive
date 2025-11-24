import type { Id } from 'convex/_generated/dataModel'
import {
  SIDEBAR_ROOT_TYPE,
  type SidebarItemType,
} from 'convex/sidebarItems/types'
import { createContext, useCallback, useContext, useState, useRef } from 'react'
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
  canDropCategoryItem,
  type CategoryDragData,
  type CategoryDropData,
} from '~/components/notes-page/category/dnd-utils'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { executeMove } from '~/utils/dnd-utils'

type CategoryDragContextType = {
  activeDragItem: CategoryDragData | null
}

const CategoryDragContext = createContext<CategoryDragContextType | null>(null)

export function CategoryDragProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { moveFolder } = useFolderActions()
  const { moveNote } = useNoteActions()

  const moveMap = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.moveMap),
  })

  const [activeDragItem, setActiveDragItem] = useState<CategoryDragData | null>(
    null,
  )
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 })
  const pointerListenerRef = useRef<(() => void) | null>(null)

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
    const item = active.data.current as CategoryDragData
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

      // Validate the drop
      if (!canDropCategoryItem(active, over)) return

      const draggedItem = active.data.current as CategoryDragData
      const targetData = over.data.current as CategoryDropData

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
        {},
      ).catch((error) => {
        console.error('Failed to move item:', error)
      })
    },
    [moveNote, moveFolder, moveMap],
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

  const value: CategoryDragContextType = {
    activeDragItem,
  }

  return (
    <CategoryDragContext.Provider value={value}>
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
    </CategoryDragContext.Provider>
  )
}

export const useCategoryDrag = () => {
  const context = useContext(CategoryDragContext)
  if (!context) {
    throw new Error('useCategoryDrag must be used within a CategoryDragProvider')
  }
  return context
}

