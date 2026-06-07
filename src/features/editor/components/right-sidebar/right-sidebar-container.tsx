import { useEffect, useRef } from 'react'
import { List } from 'lucide-react'
import { RIGHT_SIDEBAR_CONTENT } from './constants'
import { RightSidebar } from './right-sidebar'
import { useRightSidebar } from '~/features/editor/hooks/useRightSidebar'
import { ResizableSidebar } from '~/features/sidebar/components/resizable-sidebar'
import { Button } from '~/features/shadcn/components/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'
import { canShowRightSidebarContent } from './right-sidebar-model'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'

export function RightSidebarContainer({ item }: { item: AnySidebarItem | null }) {
  const sidebar = useRightSidebar(item?.type)

  const prevItemIdRef = useRef(item?._id)
  useEffect(() => {
    if (prevItemIdRef.current !== item?._id) {
      prevItemIdRef.current = item?._id
      sidebar.close()
    }
  }, [sidebar, item?._id])

  if (!item) return null

  const canOpenOutline = canShowRightSidebarContent(item.type, RIGHT_SIDEBAR_CONTENT.outline)

  return (
    <>
      {canOpenOutline && !sidebar.visible && (
        <div className="absolute top-12 right-2 z-10" data-testid="outline-toggle-container">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => sidebar.open(RIGHT_SIDEBAR_CONTENT.outline)}
                  aria-label="Open outline"
                />
              }
            >
              <List className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="left">Outline</TooltipContent>
          </Tooltip>
        </div>
      )}
      {sidebar.visible && (
        <ResizableSidebar
          side="right"
          size={sidebar.size}
          visible={sidebar.visible}
          onSizeChange={sidebar.setSize}
          onVisibleChange={sidebar.setVisible}
          isLoaded={sidebar.isLoaded}
          minWidth={200}
        >
          <RightSidebar
            itemId={item._id}
            itemType={item.type}
            activeContentId={sidebar.activeContentId}
            onContentChange={sidebar.setActiveContent}
            onClose={sidebar.close}
          />
        </ResizableSidebar>
      )}
    </>
  )
}
