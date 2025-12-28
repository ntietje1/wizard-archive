import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useDraggable } from '@dnd-kit/core'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import type { SidebarDragData } from '~/lib/dnd-utils'
import type { ItemCardProps } from './item-card'
import type { Tag } from 'convex/tags/types'
import { getCategoryIcon } from '~/lib/category-icons'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { Card, CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { getTagColor } from '~/hooks/useTags'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { SidebarItemContextMenu } from '~/components/context-menu/sidebar/SidebarItemContextMenu'

export function TagCard({
  item: tag,
  category,
  onClick,
  isLoading,
}: ItemCardProps<Tag>) {
  const { navigateToTag } = useEditorNavigation()
  const { activeDragItem } = useFileSidebar()
  const isDisabled = activeDragItem !== null

  const tagColor = getTagColor(tag)

  const imageUrlQuery = useQuery(
    convexQuery(
      api.storage.queries.getDownloadUrl,
      tag.imageStorageId ? { storageId: tag.imageStorageId } : 'skip',
    ),
  )

  const imageUrl = imageUrlQuery.data || null

  const tagCategory = category || tag.category
  const dragData: SidebarDragData = {
    _id: tag._id,
    type: SIDEBAR_ITEM_TYPES.tags,
    name: tag.name || '',
    parentId: tag.parentId,
    categoryId: tagCategory?._id,
    icon: getCategoryIcon(tagCategory?.iconName ?? 'TagIcon'),
  }

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: tag._id,
    data: dragData,
    disabled: isDisabled,
  })

  const hasImage = !!imageUrl && !imageUrlQuery.isLoading
  const isLoadingImage = imageUrlQuery.isLoading && tag.imageStorageId
  const CategoryIcon = getCategoryIcon(tagCategory?.iconName)

  const handleCardActivate = () => {
    if (!isDragging) {
      if (onClick) {
        onClick()
      } else if (tag.slug) {
        navigateToTag(tag.slug)
      }
    }
  }

  if (isLoading) {
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

  const cardContent = (
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
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <CategoryIcon className="w-6 h-6 text-amber-600 select-none flex-shrink-0" />
              <CardTitle className="text-xl text-slate-800 truncate select-none">
                {tag.name || 'Unnamed Tag'}
              </CardTitle>
            </div>
            {tag.description && (
              <p className="text-sm text-slate-600 line-clamp-3 w-full overflow-hidden break-words">
                {tag.description}
              </p>
            )}
          </div>
        </div>

        {/* Image Section */}
        <div className="w-24 aspect-[5/6] flex-shrink-0 relative overflow-hidden rounded-sm">
          {isLoadingImage ? (
            <Skeleton className="w-full h-full" />
          ) : hasImage ? (
            <img
              src={imageUrl}
              alt={tag.name || 'Unnamed Tag'}
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
      </Card>
    </div>
  )

  return (
    <SidebarItemContextMenu
      item={tag}
      viewContext="folder-view"
      category={tagCategory}
    >
      {cardContent}
    </SidebarItemContextMenu>
  )
}
