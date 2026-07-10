import type { LucideIcon } from 'lucide-react'
import { ClientOnly } from '@wizard-archive/ui/components/client-only'
import { Card } from '@wizard-archive/ui/shadcn/components/card'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { useState } from 'react'
import type { AnyItem } from '../../workspace/items'
import { sidebarItemIconClass } from '../../workspace/sidebar/item-visual-state'
import { useSidebarItemVisualState } from '../../workspace/sidebar/use-sidebar-item-visual-state'
import { ResourceItemCardShell } from './shell'
import type { ResourceItemCardProps } from './shell'

type PreviewImageItem = AnyItem & {
  previewUrl?: string | null
}

type PreviewImageResourceItemCardProps<TItem extends PreviewImageItem> =
  ResourceItemCardProps<TItem> & {
    fallbackIcon: LucideIcon
    fallbackLabel: string
    imageAlt: (item: TItem) => string
    imageClassName?: string
    imageDraggable?: boolean
  }

function PreviewImageResourceItemCardSkeleton() {
  return (
    <div className="w-full h-[140px]">
      <Card className="w-full h-full flex flex-col p-2 relative rounded-md">
        <div className="flex items-center justify-between mb-2">
          <div className="bg-muted rounded-md h-5 w-32" />
          <div className="bg-muted rounded-md size-6" />
        </div>
        <div className="w-full flex-1 bg-muted relative rounded-sm overflow-hidden">
          <div className="bg-muted w-full h-full" />
        </div>
      </Card>
    </div>
  )
}

function PreviewImageResourceItemCardInner<TItem extends PreviewImageItem>({
  item,
  fallbackIcon: FallbackIcon,
  fallbackLabel,
  imageAlt,
  imageClassName,
  imageDraggable,
  ...props
}: PreviewImageResourceItemCardProps<TItem>) {
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null)
  const previewUrl =
    item.previewUrl && failedPreviewUrl !== item.previewUrl ? item.previewUrl : null
  const visualState = useSidebarItemVisualState(item, props.source.currentItemId)

  return (
    <ResourceItemCardShell
      {...props}
      item={item}
      visualState={visualState}
      preview={
        <div className="w-full flex-1 bg-muted relative rounded-sm overflow-hidden">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={imageAlt(item)}
              className={cn('w-full h-full object-cover', imageClassName)}
              loading="lazy"
              draggable={imageDraggable ?? false}
              onError={() => setFailedPreviewUrl(previewUrl)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FallbackIcon
                className={cn('size-12', sidebarItemIconClass(visualState))}
                aria-hidden
              />
              <span className="sr-only">{fallbackLabel}</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10" />
        </div>
      }
    />
  )
}

export function PreviewImageResourceItemCard<TItem extends PreviewImageItem>(
  props: PreviewImageResourceItemCardProps<TItem>,
) {
  if (props.isLoading) {
    return <PreviewImageResourceItemCardSkeleton />
  }

  return (
    <ClientOnly fallback={<PreviewImageResourceItemCardSkeleton />}>
      <PreviewImageResourceItemCardInner {...props} />
    </ClientOnly>
  )
}
