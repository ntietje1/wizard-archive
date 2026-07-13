import { useState } from 'react'
import { File as FileIconLucide, FileText, Image, Music, Video } from 'lucide-react'
import { ClientOnly } from '@wizard-archive/ui/components/client-only'
import type { FileItem } from '../item-contract'
import { Card } from '@wizard-archive/ui/shadcn/components/card'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { sidebarItemIconClass } from '../../workspace/sidebar/item-visual-state'
import { useSidebarItemVisualState } from '../../workspace/sidebar/use-sidebar-item-visual-state'
import { ResourceItemCardShell } from '../../filesystem/cards/shell'
import type { ResourceItemCardProps } from '../../filesystem/cards/shell'
import { getFileTypeCategory } from '../file-type-category'
import { isValidFileUrl } from './file-url-validation'

const FILE_TYPE_ICONS = {
  image: Image,
  pdf: FileText,
  video: Video,
  audio: Music,
  file: FileIconLucide,
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

function FileCardInner({ item: file, ...props }: ResourceItemCardProps<FileItem>) {
  const FileIcon = FILE_TYPE_ICONS[getFileTypeCategory(file.contentType, file.name)]
  const [erroredUrl, setErroredUrl] = useState<string | null>(null)
  const safePreviewUrl = file.previewUrl && isValidFileUrl(file.previewUrl) ? file.previewUrl : null
  const imageError = erroredUrl === safePreviewUrl
  const visualState = useSidebarItemVisualState(file, props.source.currentItemId)

  return (
    <ResourceItemCardShell
      {...props}
      item={file}
      visualState={visualState}
      preview={
        <div className="w-full flex-1 bg-muted relative rounded-sm overflow-hidden flex items-center justify-center">
          {safePreviewUrl && !imageError ? (
            <img
              src={safePreviewUrl}
              alt={file.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={() => setErroredUrl(safePreviewUrl)}
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

export function FileCard(props: ResourceItemCardProps<FileItem>) {
  if (props.isLoading) {
    return <FileCardSkeleton />
  }

  return (
    <ClientOnly fallback={<FileCardSkeleton />}>
      <FileCardInner {...props} />
    </ClientOnly>
  )
}
