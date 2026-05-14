import { ClientOnly } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import type { GameMap } from 'convex/gameMaps/types'
import type { ItemCardProps } from './item-card'
import { Card } from '~/features/shadcn/components/card'
import { cn } from '~/features/shadcn/lib/utils'
import { sidebarItemIconClass } from '~/features/sidebar/utils/sidebar-item-visual-state'
import { FolderItemCardShell } from './folder-item-card-shell'

function MapCardSkeleton() {
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

function MapCardInner({ item: map, ...props }: ItemCardProps<GameMap>) {
  const previewUrl = map.previewUrl ?? null

  return (
    <FolderItemCardShell
      {...props}
      item={map}
      renderPreview={(visualState) => (
        <div className="w-full flex-1 bg-muted relative rounded-sm overflow-hidden">
          {previewUrl ? (
            <img src={previewUrl} alt={map.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin className={cn('size-12', sidebarItemIconClass(visualState))} />
            </div>
          )}
          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10" />
        </div>
      )}
    />
  )
}

export function MapCard(props: ItemCardProps<GameMap>) {
  if (props.isLoading) {
    return <MapCardSkeleton />
  }

  return (
    <ClientOnly fallback={<MapCardSkeleton />}>
      <MapCardInner {...props} />
    </ClientOnly>
  )
}
