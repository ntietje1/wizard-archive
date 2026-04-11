import { useRef, useState } from 'react'
import { ClientOnly, Link } from '@tanstack/react-router'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import { Grid2x2Plus, MoreVertical } from 'lucide-react'
import type { Canvas } from 'convex/canvases/types'
import type { ItemCardProps } from './item-card'
import { Card, CardTitle } from '~/features/shadcn/components/card'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'
import { useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useIsSelectedItem } from '~/features/sidebar/hooks/useSelectedItem'
import { useContextMenu } from '~/features/context-menu/hooks/useContextMenu'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useDraggable } from '~/features/dnd/hooks/useDraggable'

function CanvasCardSkeleton() {
  return (
    <div className="w-full h-[140px]">
      <Card className="w-full h-full flex flex-col p-2 relative rounded-md">
        <div className="flex items-center justify-between mb-2">
          <div className="bg-muted rounded-md h-5 w-32" />
          <div className="bg-muted rounded-md w-6 h-6" />
        </div>
        <div className="w-full flex-1 bg-muted relative rounded-sm overflow-hidden">
          <div className="bg-muted w-full h-full" />
        </div>
      </Card>
    </div>
  )
}

function CanvasCardInner({ item: canvas, onClick }: ItemCardProps<Canvas>) {
  const ref = useRef<HTMLDivElement>(null)
  const [erroredUrl, setErroredUrl] = useState<string | null>(null)
  const imageError = erroredUrl === canvas.previewUrl
  const linkProps = useEditorLinkProps(canvas)
  const { setLastSelectedItem } = useLastEditorItem()
  const canDrag = hasAtLeastPermissionLevel(canvas.myPermissionLevel, PERMISSION_LEVEL.FULL_ACCESS)
  const isSelected = useIsSelectedItem(canvas)
  const { contextMenuRef, handleMoreOptions } = useContextMenu()

  const { isDraggingRef } = useDraggable({
    ref,
    data: { sidebarItemId: canvas._id },
    canDrag,
    dragOpacity: '0.2',
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
          setLastSelectedItem(canvas.slug)
        }}
      >
        <Card
          className={cn(
            'w-full h-full cursor-pointer group flex flex-col p-2 relative rounded-md hover:bg-muted/70',
            isSelected && 'ring-ring ring-2',
          )}
        >
          <div className="flex items-center justify-between mb-1 min-w-0">
            <CardTitle className="p-1 text-sm font-medium text-foreground truncate select-none flex-1 min-w-0">
              {canvas.name}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring transition-opacity"
              aria-label="More options"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleMoreOptions(e)
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>

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
                <Grid2x2Plus className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10" />
          </div>
        </Card>
      </Link>
    </div>
  )

  return (
    <EditorContextMenu ref={contextMenuRef} viewContext="folder-view" item={canvas}>
      {cardContent}
    </EditorContextMenu>
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
