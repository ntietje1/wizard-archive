import type { Id } from 'convex/_generated/dataModel'
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
import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import {
  canDropCategoryItem,
  type CategoryDragData,
  type CategoryDropData,
  CATEGORY_ITEM_TYPES,
  CATEGORY_ROOT_TYPE,
} from '~/routes/_authed/campaigns/$dmUsername.$campaignSlug/categories/$categorySlug/-components/dnd-utils'
import { useFolderActions } from '~/hooks/useFolderActions'

type CategoryDragContextType = {
  activeDragData: CategoryDragData | null
  isEnabled: boolean
}

const CategoryDragContext = createContext<CategoryDragContextType | null>(null)

export function CategoryDragProvider({
  children,
  isEnabled,
}: {
  children: React.ReactNode
  isEnabled: boolean
}) {
  const [activeDragData, setActiveDragData] = useState<CategoryDragData | null>(
    null,
  )
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 })
  const pointerListenerRef = useRef<(() => void) | null>(null)

  const { moveFolder } = useFolderActions()

  const moveNote = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.moveNote),
  })

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
    const data = active.data.current as CategoryDragData
    if (data && data.type) {
      setActiveDragData(data)

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
      setActiveDragData(null)
      setPointerOffset({ x: 0, y: 0 })

      if (pointerListenerRef.current) {
        pointerListenerRef.current()
        pointerListenerRef.current = null
      }

      if (!isEnabled || !active.data.current || !over) {
        return
      }

      if (!canDropCategoryItem(active, over)) return

      const draggedData = active.data.current as CategoryDragData
      const targetData = over.data.current as CategoryDropData

      if (draggedData.type === CATEGORY_ITEM_TYPES.folders) {
        try {
          let parentId: Id<'folders'> | undefined = undefined
          if (targetData.type !== CATEGORY_ROOT_TYPE) {
            parentId = over.id as Id<'folders'>
          }

          await moveFolder.mutateAsync({
            folderId: draggedData._id as Id<'folders'>,
            parentId: parentId,
          })
        } catch (error) {
          console.error(error)
        }
      }

      if (draggedData.type === CATEGORY_ITEM_TYPES.tags) {
        try {
          if (draggedData.noteId) {
            let parentFolderId: Id<'folders'> | undefined = undefined
            if (targetData.type !== CATEGORY_ROOT_TYPE) {
              parentFolderId = over.id as Id<'folders'>
            }

            await moveNote.mutateAsync({
              noteId: draggedData.noteId,
              parentFolderId: parentFolderId,
            })
          }
        } catch (error) {
          console.error(error)
        }
      }
    },
    [isEnabled, moveNote, moveFolder],
  )

  const handleDragCancel = useCallback(() => {
    // Clean up pointer listener
    if (pointerListenerRef.current) {
      pointerListenerRef.current()
      pointerListenerRef.current = null
    }
    setActiveDragData(null)
    setPointerOffset({ x: 0, y: 0 })
  }, [])

  const value: CategoryDragContextType = {
    activeDragData,
    isEnabled,
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
          {activeDragData ? (
            <div className="h-6 bg-background rounded-sm shadow-lg p-2 flex items-center justify-center gap-1 animate-overlay-shrink">
              <activeDragData.icon className="w-5 h-5" />
              <span className="text-sm text-foreground font-semibold">
                {activeDragData.name}
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
    throw new Error(
      'useCategoryDrag must be used within a CategoryDragProvider',
    )
  }
  return {
    activeDragItem: context.activeDragData,
    isEnabled: context.isEnabled,
  }
}
