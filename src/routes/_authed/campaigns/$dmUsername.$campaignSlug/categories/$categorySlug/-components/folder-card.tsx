import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { UNTITLED_FOLDER_NAME } from 'convex/notes/types'
import type { Folder } from 'convex/notes/types'
import { useState, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { FolderDialog } from '~/components/forms/folder-dialog/folder-dialog'
import { Edit, Trash2, Folder as FolderIcon } from '~/lib/icons'
import { useDraggable, useDroppable, useDndContext } from '@dnd-kit/core'
import {
  CATEGORY_ITEM_TYPES,
  validateCategoryItemDrop,
  type CategoryDragData,
  type CategoryDropData,
} from './dnd-utils'
import { useCategoryDrag } from '~/contexts/CategoryDragContext'
import { Card, CardHeader } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import './folder-card.css'

interface FolderCardProps {
  folder?: Folder
  categoryId?: Id<'tagCategories'>
  onClick?: (e: MouseEvent) => void
  className?: string
  isLoading?: boolean
}

export function FolderCard({
  folder,
  categoryId,
  onClick,
  className = '',
  isLoading = false,
}: FolderCardProps) {
  const [editing, setEditing] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { activeDragItem } = useCategoryDrag()
  const isDisabled = activeDragItem !== null
  const { active } = useDndContext()

  if (isLoading || !folder || !categoryId) {
    return (
      <Card className={`h-[140px] ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="w-8 h-8 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
            <Skeleton className="w-8 h-8 rounded" />
          </div>
        </CardHeader>
      </Card>
    )
  }

  const dropData: CategoryDropData = {
    _id: folder._id,
    type: CATEGORY_ITEM_TYPES.folders,
    categoryId,
  }
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: folder._id,
    data: dropData,
  })

  const isValidDropTarget =
    isOver &&
    validateCategoryItemDrop(
      active?.data?.current as CategoryDragData | null,
      dropData,
    )

  const dragData: CategoryDragData = {
    _id: folder._id,
    type: CATEGORY_ITEM_TYPES.folders,
    name: folder.name || UNTITLED_FOLDER_NAME,
    parentFolderId: folder.parentFolderId,
    icon: FolderIcon,
  }
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: folder._id,
    data: dragData,
  })

  const updateFolder = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.updateFolder),
  })
  const deleteFolder = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.deleteFolder),
  })

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteFolder.mutateAsync({ folderId: folder._id })
      setDeletingFolder(false)
    } catch (error) {
      toast.error('Failed to delete folder')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div
        ref={(el) => {
          setDropRef(el)
          setDragRef(el)
        }}
        {...listeners}
        {...attributes}
        className={`${className} ${isDragging ? 'opacity-20' : ''}`}
      >
        <div
          className={`folder-wrapper group bg-white transition-all ${
            isValidDropTarget ? 'valid-drop-target' : ''
          }`}
        >
          <div className="folder">
            {/* Left part with folder tab */}
            <div className="folder-left">
              <svg viewBox="0 0 120 200" preserveAspectRatio="none">
                <path
                  d="M 100,25 L 83,10 L 20,10 C 11,10 5,16 5,25 L 5,175 C 5,184 11,190 20,190 L 120,190 L 120,25 Z"
                  fill="currentColor"
                  // stroke="#e2e8f0"
                  // strokeWidth="1.5px"
                />
              </svg>
            </div>

            {/* Middle part (stretches horizontally) */}
            <div className="folder-middle">
              <svg viewBox="0 0 20 200" preserveAspectRatio="none">
                <rect
                  x="0"
                  y="25"
                  width="20"
                  height="165"
                  fill="currentColor"
                  // stroke="#e2e8f0"
                  // strokeWidth="1.5px"
                />
              </svg>
            </div>

            {/* Right part with rounded corners */}
            <div className="folder-right">
              <svg viewBox="0 0 60 200" preserveAspectRatio="none">
                <path
                  d="M 0,25 L 50,25 C 56,25 60,29 60,35 L 60,175 C 60,184 54,190 45,190 L 0,190 Z"
                  fill="currentColor"
                  // stroke="#e2e8f0"
                  // strokeWidth="1.5px"
                />
              </svg>
            </div>

            {/* Overlay rectangle to hide seams */}
            <div className="folder-seam-cover"></div>
          </div>

          {/* Content inside folder */}
          <div className="folder-content" onClick={onClick || (() => {})}>
            <div className="flex items-center gap-2">
              <FolderIcon className="w-6 h-6 text-amber-600 select-none flex-shrink-0" />
              <h2 className="text-xl text-slate-800 truncate select-none">
                {folder.name || UNTITLED_FOLDER_NAME}
              </h2>
            </div>
          </div>

          {/* Action buttons */}
          {!isDisabled && (
            <div className="absolute top-3 right-3 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation()
                  setEditing(true)
                }}
                className="bg-white/90 hover:bg-white shadow-sm"
                aria-label="Edit"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation()
                  setDeletingFolder(true)
                }}
                className="bg-white/90 hover:bg-white shadow-sm text-red-600 hover:text-red-700"
                aria-label="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <FolderDialog
          isOpen={editing}
          onClose={() => setEditing(false)}
          mode="edit"
          folderId={folder._id}
          initialName={folder.name || ''}
          onSubmit={async (values) => {
            try {
              await updateFolder.mutateAsync({
                folderId: folder._id,
                name: values.name,
              })
              setEditing(false)
            } catch (_) {
              toast.error('Failed to update folder')
            }
          }}
        />
      )}

      <ConfirmationDialog
        isOpen={deletingFolder}
        onClose={() => setDeletingFolder(false)}
        onConfirm={handleDelete}
        title="Delete Folder"
        description={`Are you sure you want to delete ${folder.name ? `"${folder.name}"` : 'this folder'}? This will also delete all notes inside this folder. This action cannot be undone.`}
        confirmLabel="Delete Folder"
        isLoading={isDeleting}
        icon={FolderIcon}
      />
    </>
  )
}
