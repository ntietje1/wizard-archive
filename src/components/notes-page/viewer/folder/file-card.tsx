import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useDraggable } from '@dnd-kit/core'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { LucideIcon } from 'lucide-react'
import type { SidebarDragData } from '~/lib/dnd-utils'
import type { ItemCardProps } from './item-card'
import type { File } from 'convex/files/types'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { Card, CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import {
  File as FileIconLucide,
  FileText,
  Image,
  MoreVertical,
  Music,
  Video,
} from '~/lib/icons'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useContextMenu } from '~/hooks/useContextMenu'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'

function getFileTypeIcon(
  contentType: string | null | undefined,
  fileName: string | null | undefined,
): LucideIcon {
  if (!contentType && !fileName) {
    return FileIconLucide
  }

  const mimeType = contentType?.toLowerCase() ?? ''
  const name = fileName?.toLowerCase() ?? ''

  if (
    mimeType.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(name)
  ) {
    return Image
  }
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
    return FileText
  }
  if (
    mimeType.startsWith('video/') ||
    /\.(mp4|webm|ogg|mov|avi|wmv|flv)$/i.test(name)
  ) {
    return Video
  }
  if (
    mimeType.startsWith('audio/') ||
    /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(name)
  ) {
    return Music
  }
  return FileIconLucide
}

export function FileCard({
  item: file,
  onClick,
  isLoading,
}: ItemCardProps<File>) {
  const { navigateToFile } = useEditorNavigation()
  const { activeDragItem } = useFileSidebar()
  const isDisabled = activeDragItem !== null
  const { contextMenuRef, handleMoreOptions } = useContextMenu()

  const metadataQuery = useQuery(
    convexQuery(
      api.storage.queries.getStorageMetadata,
      file.storageId ? { storageId: file.storageId } : 'skip',
    ),
  )

  const contentType = metadataQuery.data?.contentType ?? null
  const FileIcon = getFileTypeIcon(contentType, file.name)

  const dragData: SidebarDragData = file

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: file._id,
    data: dragData,
    disabled: isDisabled,
  })

  const handleCardActivate = () => {
    if (!isDragging) {
      if (onClick) {
        onClick()
      } else if (file.slug) {
        navigateToFile(file.slug)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="w-full h-[140px]">
        <Card className="w-full h-full flex flex-col p-2 relative rounded-md">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="w-6 h-6 rounded" />
          </div>
          <div className="flex items-center justify-center flex-1">
            <Skeleton className="w-12 h-12 rounded" />
          </div>
        </Card>
      </div>
    )
  }

  const cardContent = (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`w-full h-[140px] ${isDragging ? 'opacity-50' : ''}`}
    >
      <Card
        className="w-full h-full cursor-pointer transition-all hover:shadow-md group flex flex-col p-2 relative rounded-md"
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
        {/* Top Section: Title + Menu Button */}
        <div className="flex items-center justify-between min-w-0">
          <CardTitle className="p-1 text-sm font-medium text-slate-800 truncate select-none flex-1 min-w-0">
            {file.name || defaultItemName(file)}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              handleMoreOptions(e)
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        {/* Icon Section: Centered Large Icon */}
        <div className="flex items-center justify-center flex-1 mb-10">
          <FileIcon
            className={`w-12 h-12 select-none ${
              contentType?.startsWith('image/')
                ? 'text-blue-500'
                : contentType === 'application/pdf'
                  ? 'text-red-500'
                  : contentType?.startsWith('video/')
                    ? 'text-purple-500'
                    : contentType?.startsWith('audio/')
                      ? 'text-green-500'
                      : 'text-slate-500'
            }`}
          />
        </div>
      </Card>
    </div>
  )

  return (
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext="folder-view"
      item={file}
    >
      {cardContent}
    </EditorContextMenu>
  )
}
