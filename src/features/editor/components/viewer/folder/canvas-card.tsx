import { useState } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { Grid2x2Plus } from 'lucide-react'
import type { Canvas } from 'convex/canvases/types'
import type { ItemCardProps } from './item-card'
import { Card } from '~/features/shadcn/components/card'
import { cn } from '~/features/shadcn/lib/utils'
import { sidebarItemIconClass } from '~/features/sidebar/utils/sidebar-item-visual-state'
import { useSidebarItemVisualState } from '~/features/sidebar/hooks/useSelectedItem'
import { FolderItemCardShell } from './folder-item-card-shell'

function CanvasCardSkeleton() {
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

function CanvasCardInner({ item: canvas, ...props }: ItemCardProps<Canvas>) {
  const [erroredUrl, setErroredUrl] = useState<string | null>(null)
  const imageError = erroredUrl === canvas.previewUrl
  const visualState = useSidebarItemVisualState(canvas)

  return (
    <FolderItemCardShell
      {...props}
      item={canvas}
      visualState={visualState}
      preview={
        <div className="w-full flex-1 bg-muted relative rounded-sm overflow-hidden">
          {canvas.previewUrl && !imageError ? (
            <img
              src={canvas.previewUrl}
              alt={`Preview of ${canvas.name}`}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setErroredUrl(canvas.previewUrl)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Grid2x2Plus className={cn('size-12', sidebarItemIconClass(visualState))} />
            </div>
          )}
          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10" />
        </div>
      }
    />
  )
}

export function CanvasCard(props: ItemCardProps<Canvas>) {
  if (props.isLoading) {
    return <CanvasCardSkeleton />
  }

  return (
    <ClientOnly fallback={<CanvasCardSkeleton />}>
      <CanvasCardInner {...props} />
    </ClientOnly>
  )
}
