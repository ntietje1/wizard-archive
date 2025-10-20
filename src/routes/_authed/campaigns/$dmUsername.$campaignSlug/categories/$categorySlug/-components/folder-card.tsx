import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { UNTITLED_FOLDER_NAME } from 'convex/notes/types'
import type { Folder } from 'convex/notes/types'
import { useState, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { ContentCard } from '~/components/content-grid-page/content-card'
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

interface FolderCardProps {
  folder: Folder
  categoryId: Id<'tagCategories'>
  onClick: (e: MouseEvent) => void
  className?: string
}

export function FolderCard({
  folder,
  categoryId,
  onClick,
  className = '',
}: FolderCardProps) {
  const [editing, setEditing] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { activeDragItem } = useCategoryDrag()
  const isDisabled = activeDragItem !== null
  const { active } = useDndContext()

  const dropData: CategoryDropData = {
    id: folder._id,
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
      >
        <ContentCard
          title={folder.name || UNTITLED_FOLDER_NAME}
          icon={FolderIcon}
          onClick={onClick}
          className={`${className} ${isDragging ? 'opacity-20' : ''}`}
          actionButtons={[
            {
              icon: Edit,
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                setEditing(true)
              },
              'aria-label': 'Edit',
              disabled: isDisabled,
            },
            {
              icon: Trash2,
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                setDeletingFolder(true)
              },
              'aria-label': 'Delete',
              variant: 'destructive-subtle',
              disabled: isDisabled,
            },
          ]}
          hoverEffect={{
            enabled: true,
            className: isValidDropTarget
              ? 'hover:border-amber-300 hover:bg-amber-300/10 hover:shadow-lg hover:scale-101 transition-all duration-100 hover:duration-200'
              : '',
          }}
        />
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
