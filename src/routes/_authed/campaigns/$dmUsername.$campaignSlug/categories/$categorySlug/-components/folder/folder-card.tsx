import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_TYPES, UNTITLED_FOLDER_NAME } from 'convex/notes/types'
import type { Folder } from 'convex/notes/types'
import { useState, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { FolderDialog } from '~/components/forms/folder-dialog/folder-dialog'
import { Edit, Trash2, Folder as FolderIcon } from '~/lib/icons'
import { useDraggable, useDroppable, useDndContext } from '@dnd-kit/core'
import {
  validateCategoryItemDrop,
  type CategoryDragData,
  type CategoryDropData,
} from '../dnd-utils'
import { useCategoryDrag } from '~/contexts/CategoryDragContext'
import { CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import './folder-card.css'
import { CategoryFolderContextMenu } from './category-folder-context-menu'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'

function FolderSvg() {
  return (
    <div className="folder">
      {/* Left section */}
      <div className="folder-left">
        <svg viewBox="0 0 120 200" preserveAspectRatio="none">
          <path
            d="M 100,15 L 85,0 L 10,0 C 5,0 0,5 0,15 L 0,185 C 0,195 5,200 10,200 L 120,200 L 120,15 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Middle section */}
      <div className="folder-middle">
        <svg viewBox="0 0 20 200" preserveAspectRatio="none">
          <rect x="0" y="15" width="20" height="200" fill="currentColor" />
        </svg>
      </div>

      {/* Right section*/}
      <div className="folder-right">
        <svg viewBox="0 0 60 200" preserveAspectRatio="none">
          <path
            d="M 0,15 L 50,15 C 55,15 59,17 60,25 L 60,185 C 60,195 57,200 50,200 L 0,200 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Background (hides seams) */}
      <div className="folder-seam-cover"></div>
    </div>
  )
}

export interface FolderCardProps {
  folder?: Folder
  categoryId?: Id<'tagCategories'>
  categoryConfig?: TagCategoryConfig
  onClick?: (e: MouseEvent) => void
  className?: string
  isLoading?: boolean
}

export function FolderCardWithContextMenu(props: FolderCardProps) {
  if (!props.categoryConfig) {
    return <FolderCard {...props} />
  }
  return (
    <CategoryFolderContextMenu
      categoryConfig={props.categoryConfig}
      folder={props.folder}
    >
      <FolderCard {...props} />
    </CategoryFolderContextMenu>
  )
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
      <div className={`h-[140px] ${className}`}>
        <div className="folder-wrapper">
          <FolderSvg />
          {/* Folder content skeleton */}
          <div className="folder-content p-3">
            <div className="flex items-center gap-2 min-w-0">
              <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const dropData: CategoryDropData = {
    _id: folder._id,
    type: SIDEBAR_ITEM_TYPES.folders,
    categoryId: folder.categoryId,
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
    type: SIDEBAR_ITEM_TYPES.folders,
    name: folder.name || UNTITLED_FOLDER_NAME,
    parentFolderId: folder.parentFolderId,
    categoryId: folder.categoryId,
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

  const handleCardActivate = (e?: MouseEvent) => {
    if (!isDragging && onClick) {
      onClick(e || ({} as MouseEvent))
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
        className={`h-[140px] ${className} ${isDragging ? 'opacity-20' : ''}`}
      >
        <div
          className={`folder-wrapper group transition-all ${
            isValidDropTarget ? 'valid-drop-target' : ''
          }`}
          onClick={handleCardActivate}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleCardActivate()
            }
          }}
          tabIndex={0}
          role="button"
        >
          <FolderSvg />

          {/* Folder name */}
          <div className="folder-content p-3">
            <div className="flex items-center gap-2 min-w-0">
              <FolderIcon className="w-6 h-6 text-amber-600 select-none flex-shrink-0" />
              <CardTitle className="text-xl text-slate-800 truncate select-none">
                {folder.name || UNTITLED_FOLDER_NAME}
              </CardTitle>
            </div>
          </div>

          {/* Action buttons */}
          {!isDisabled && (
            <div className="absolute pt-1 top-3 right-3 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
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
