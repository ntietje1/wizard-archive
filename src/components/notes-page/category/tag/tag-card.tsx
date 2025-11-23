import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { Tag } from 'convex/tags/types'
import { useState } from 'react'
import { TagDeleteConfirmDialog } from '~/components/dialogs/delete/tag-delete-confirm-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import { Edit, Trash2 } from '~/lib/icons'
import { useDraggable } from '@dnd-kit/core'
import { type CategoryDragData } from '../dnd-utils'
import type { Id } from 'convex/_generated/dataModel'
import { getCategoryIcon } from '~/lib/category-icons'
import { useCategoryDrag } from '~/contexts/CategoryDragContext'
import { Card, CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import { CategoryTagContextMenu } from '~/components/context-menu/category/category-tag-context-menu'
import { type Note } from 'convex/notes/types'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { getTagColor } from '~/hooks/useTags'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'

export interface TagCardProps {
  noteAndTag?: Note
  config?: TagCategoryConfig
  parentFolderId?: Id<'folders'>
  isLoading?: boolean
}

export function TagCardWithContextMenu(props: TagCardProps) {
  if (!props.config || !props.noteAndTag) {
    return <TagCard {...props} />
  }
  return (
    <CategoryTagContextMenu
      categoryConfig={props.config}
      noteWithTag={props.noteAndTag}
    >
      <TagCard {...props} />
    </CategoryTagContextMenu>
  )
}

export function TagCard({
  noteAndTag,
  config,
  parentFolderId,
  isLoading = false,
}: TagCardProps) {
  const { navigateToNote } = useEditorNavigation()
  const { activeDragItem } = useCategoryDrag()
  const isDisabled = activeDragItem !== null
  const tag = noteAndTag?.tag
  const tagColor = tag ? getTagColor(tag) : undefined

  const [editing, setEditing] = useState<Tag | null>(null)
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null)

  const imageUrlQuery = useQuery(
    convexQuery(
      api.storage.queries.getDownloadUrl,
      tag?.imageStorageId ? { storageId: tag.imageStorageId } : 'skip',
    ),
  )

  const imageUrl = imageUrlQuery.data || null

  const dragData: CategoryDragData | undefined =
    tag && config && noteAndTag && tag.noteId
      ? {
          _id: tag.noteId,
          type: SIDEBAR_ITEM_TYPES.notes,
          name: tag.displayName,
          parentFolderId,
          noteId: tag.noteId,
          categoryId: noteAndTag.categoryId || tag.category?._id,
          icon: getCategoryIcon(tag.category?.iconName ?? 'TagIcon'),
        }
      : undefined

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: tag?._id ?? '',
    data: dragData,
    disabled: isDisabled || !tag,
  })

  if (isLoading || !tag || !config) {
    return (
      <Card className="bg-white border border-slate-200 w-full flex flex-row flex-nowrap items-stretch gap-4 p-3 relative rounded-md">
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
        <Skeleton className="w-24 aspect-[5/6] flex-shrink-0 rounded-sm" />
      </Card>
    )
  }

  const hasImage = !!imageUrl && !imageUrlQuery.isLoading
  const isLoadingImage = imageUrlQuery.isLoading && tag.imageStorageId
  const CategoryIcon = config.icon

  const handleCardActivate = () => {
    if (!isDragging && noteAndTag?.slug) {
      navigateToNote(noteAndTag.slug)
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={isDragging ? 'opacity-50' : ''}
      >
        <Card
          className="bg-white border border-slate-200 w-full cursor-pointer transition-all hover:shadow-md group flex flex-row flex-nowrap items-stretch gap-4 p-3 relative rounded-md"
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
          {/* Left Content Section */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            {/* Icon + Title */}
            <div className="overflow-hidden">
              <div className="flex items-center gap-2 mb-2 min-w-0">
                <CategoryIcon className="w-6 h-6 text-amber-600 select-none flex-shrink-0" />
                <CardTitle className="text-xl text-slate-800 truncate select-none">
                  {tag.displayName}
                </CardTitle>
              </div>
              {/* Description */}
              {tag.description && (
                <p className="text-sm text-slate-600 line-clamp-3 w-full overflow-hidden break-words">
                  {tag.description}
                </p>
              )}
            </div>
          </div>

          {/* Image Section  */}
          <div className="w-24 aspect-[5/6] flex-shrink-0 relative overflow-hidden rounded-sm">
            {isLoadingImage ? (
              <Skeleton className="w-full h-full" />
            ) : hasImage ? (
              <img
                src={imageUrl}
                alt={tag.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: tagColor }}
              >
                <CategoryIcon className="w-8 h-8 text-white/80" />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="absolute top-3 right-3 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isDisabled && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditing(tag)
                  }}
                  className="bg-white/90 hover:bg-white shadow-sm"
                  aria-label="Edit"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeletingTag(tag)
                  }}
                  className="bg-white/90 hover:bg-white shadow-sm text-red-600 hover:text-red-700"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>

      {editing && (
        <GenericTagDialog
          mode="edit"
          isOpen={true}
          onClose={() => setEditing(null)}
          config={config}
          tag={editing}
        />
      )}

      {deletingTag && config && (
        <TagDeleteConfirmDialog
          tag={deletingTag}
          categoryConfig={config}
          isDeleting={!!deletingTag}
          onClose={() => setDeletingTag(null)}
        />
      )}
    </>
  )
}

