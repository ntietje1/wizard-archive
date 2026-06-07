import { useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { MoreVertical } from 'lucide-react'
import type { ItemCardProps } from './item-card'
import { Card, CardTitle } from '~/features/shadcn/components/card'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'
import { useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import type { SidebarItemVisualState } from '~/features/sidebar/utils/sidebar-item-visual-state'
import {
  sidebarItemNameClass,
  sidebarItemIconClass,
} from '~/features/sidebar/utils/sidebar-item-visual-state'
import { useContextMenu } from '~/features/context-menu/hooks/useContextMenu'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useDraggable } from '~/features/dnd/hooks/useDraggable'
import { useItemSelectionInteractions } from '~/features/sidebar/hooks/useItemSelectionInteractions'
import { useSidebarDragData } from '~/features/dnd/hooks/useSidebarDragData'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { folderItemBackgroundClass, folderItemOutlineClass } from './folder-item-visual-state'
import { useCampaignActorPermissions } from '~/features/campaigns/hooks/useCampaignActorPermissions'

export function FolderItemCardShell<TItem extends AnySidebarItem>({
  item,
  onClick,
  parentId,
  visibleItemIds,
  itemSurface = 'folder-view',
  preview,
  visualState,
}: ItemCardProps<TItem> & {
  preview: ReactNode
  visualState: SidebarItemVisualState
}) {
  const ref = useRef<HTMLDivElement>(null)
  const linkProps = useEditorLinkProps(item)
  const { setLastSelectedItem } = useLastEditorItem()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const { handleItemClick, handleItemContextMenu } = useItemSelectionInteractions(item, {
    surface: itemSurface,
    parentId: parentId ?? null,
    visibleItemIds: visibleItemIds ?? [item._id],
  })
  const dragData = useSidebarDragData(item)
  const isDragging = useDndStore((state) => state.sidebarDragPreviewItemIds.includes(item._id))
  const actorPermissions = useCampaignActorPermissions()
  const canDrag = actorPermissions.canMutate(item, PERMISSION_LEVEL.FULL_ACCESS)
  const { isDraggingRef } = useDraggable({ ref, data: dragData, canDrag })
  const handleCardClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isDraggingRef.current) {
      event.preventDefault()
      return
    }
    if (onClick) {
      event.preventDefault()
      handleItemClick(event)
      onClick()
      return
    }
    handleItemClick(event, () => setLastSelectedItem(item.slug))
  }

  return (
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext={itemSurface === 'trash' ? 'trash-view' : 'folder-view'}
      item={item}
    >
      <div ref={ref} className={cn('w-full h-[140px]', isDragging && 'opacity-50')}>
        <Link
          {...linkProps}
          activeOptions={{ includeSearch: false }}
          aria-label={item.name}
          aria-selected={visualState.isSelected}
          data-item-selection-target="true"
          className="block w-full h-full [&.active]:pointer-events-auto"
          draggable={false}
          onContextMenu={handleItemContextMenu}
          onClick={handleCardClick}
        >
          <Card
            className={cn(
              'w-full h-full cursor-pointer group flex flex-col p-2 relative rounded-md',
              folderItemBackgroundClass(visualState),
              folderItemOutlineClass(visualState),
            )}
          >
            <div className="flex items-center justify-between mb-1 min-w-0">
              <CardTitle
                className={cn(
                  'p-1 text-sm font-medium truncate select-none flex-1 min-w-0',
                  sidebarItemNameClass(visualState),
                )}
              >
                {item.name}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0 text-muted-foreground hover:text-foreground hover:bg-item-action-hover rounded-sm flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="More options"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  handleItemContextMenu(event)
                  handleMoreOptions(event)
                }}
              >
                <MoreVertical className={cn('size-4', sidebarItemIconClass(visualState))} />
              </Button>
            </div>
            {preview}
          </Card>
        </Link>
      </div>
    </EditorContextMenu>
  )
}
