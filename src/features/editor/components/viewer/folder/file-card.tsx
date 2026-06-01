import { useState } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { File as FileIconLucide, FileText, Image, Music, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ItemCardProps } from './item-card'
import type { SidebarFile } from 'convex/files/types'
import { Card } from '~/features/shadcn/components/card'
import { cn } from '~/features/shadcn/lib/utils'
import { sidebarItemIconClass } from '~/features/sidebar/utils/sidebar-item-visual-state'
import { useSidebarItemVisualState } from '~/features/sidebar/hooks/useSelectedItem'
import { FolderItemCardShell } from './folder-item-card-shell'

function getFileTypeIcon(
  contentType: string | null | undefined,
  fileName: string | null | undefined,
): LucideIcon {
  if (!contentType && !fileName) {
    return FileIconLucide
  }

  const mimeType = contentType?.toLowerCase() ?? ''
  const name = fileName?.toLowerCase() ?? ''

  if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(name)) {
    return Image
  }
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
    return FileText
  }
  if (mimeType.startsWith('video/') || /\.(mp4|webm|ogg|mov|avi|wmv|flv)$/i.test(name)) {
    return Video
  }
  if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(name)) {
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
          <div className="bg-muted rounded-md size-6" />
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="bg-muted rounded-md size-12" />
        </div>
      </Card>
    </div>
  )
}

function FileCardInner({ item: file, ...props }: ItemCardProps<SidebarFile>) {
  const FileIcon = getFileTypeIcon(file.contentType, file.name)
  const [erroredUrl, setErroredUrl] = useState<string | null>(null)
  const imageError = erroredUrl === file.previewUrl
  const visualState = useSidebarItemVisualState(file)

  return (
    <FolderItemCardShell
      {...props}
      item={file}
      visualState={visualState}
      preview={
        <div className="w-full flex-1 bg-muted relative rounded-sm overflow-hidden flex items-center justify-center">
          {file.previewUrl && !imageError ? (
            <img
              src={file.previewUrl}
              alt={file.name}
              className="w-full h-full object-cover"
              onError={() => setErroredUrl(file.previewUrl)}
              draggable={false}
              loading="lazy"
            />
          ) : (
            <FileIcon className={cn('size-12 select-none', sidebarItemIconClass(visualState))} />
          )}
        </div>
      }
    />
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
