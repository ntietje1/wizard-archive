import { useRef } from 'react'
import { ClientOnly, Link } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import {
  File as FileIconLucide,
  FileText,
  Image,
  MoreVertical,
  Music,
  Video,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ItemCardProps } from './item-card'
import type { SidebarFile } from 'convex/files/types'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { Card, CardTitle } from '~/features/shadcn/components/card'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'
import { useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useIsSelectedItem } from '~/features/sidebar/hooks/useSelectedItem'
import { useContextMenu } from '~/features/context-menu/hooks/useContextMenu'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useDraggable } from '~/features/dnd/hooks/useDraggable'

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

function FileCardSkeleton() {
  return (
    <div className="w-full h-[140px]">
      <Card className="w-full h-full flex flex-col p-2 relative rounded-md">
        <div className="flex items-center justify-between mb-2">
          <div className="bg-muted rounded-md h-5 w-32" />
          <div className="bg-muted rounded-md w-6 h-6" />
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="bg-muted rounded-md w-12 h-12" />
        </div>
      </Card>
    </div>
  )
}

function FileCardInner({ item: file, onClick }: ItemCardProps<SidebarFile>) {
  const ref = useRef<HTMLDivElement>(null)
  const linkProps = useEditorLinkProps(file)
  const { setLastSelectedItem } = useLastEditorItem()
  const canDrag = hasAtLeastPermissionLevel(
    file.myPermissionLevel,
    PERMISSION_LEVEL.FULL_ACCESS,
  )
  const isSelected = useIsSelectedItem(file)
  const { contextMenuRef, handleMoreOptions } = useContextMenu()

  const metadataQuery = useAuthQuery(
    api.storage.queries.getStorageMetadata,
    file.storageId ? { storageId: file.storageId } : 'skip',
  )

  const contentType = metadataQuery.data?.contentType ?? null
  const FileIcon = getFileTypeIcon(contentType, file.name)

  const { isDraggingRef } = useDraggable({
    ref,
    data: { sidebarItemId: file._id },
    canDrag,
  })

  const cardContent = (
    <div ref={ref} className="w-full h-[140px]">
      <Link
        {...linkProps}
        activeOptions={{ includeSearch: false }}
        className="block w-full h-full [&.active]:pointer-events-auto"
        draggable={false}
        onClick={(e) => {
          if (isDraggingRef.current) {
            e.preventDefault()
            return
          }
          if (onClick) {
            e.preventDefault()
            onClick()
            return
          }
          setLastSelectedItem(file.slug)
        }}
      >
        <Card
          className={cn(
            'w-full h-full cursor-pointer group flex flex-col p-2 relative rounded-md hover:bg-muted/70',
            isSelected && 'ring-ring ring-2',
          )}
        >
          {/* Top Section: Title + Menu Button */}
          <div className="flex items-center justify-between min-w-0">
            <CardTitle className="p-1 text-sm font-medium text-foreground truncate select-none flex-1 min-w-0">
              {file.name}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleMoreOptions(e)
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>

          {/* Icon Section: Centered Large Icon */}
          <div className="flex items-center justify-center flex-1 mb-10">
            <FileIcon className="w-12 h-12 select-none text-muted-foreground" />
          </div>
        </Card>
      </Link>
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

export function FileCard(props: ItemCardProps<SidebarFile>) {
  if (props.isLoading) {
    return <FileCardSkeleton />
  }

  return (
    <ClientOnly fallback={<FileCardSkeleton />}>
      <FileCardInner {...props} />
    </ClientOnly>
  )
}
