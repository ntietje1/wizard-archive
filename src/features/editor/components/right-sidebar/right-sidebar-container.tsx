import { useEffect, useRef } from 'react'
import { List } from 'lucide-react'
import { RIGHT_SIDEBAR_CONTENT } from './constants'
import { RightSidebar } from './right-sidebar'
import { useRightSidebar } from '~/features/editor/hooks/useRightSidebar'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { ResizableSidebar } from '~/features/sidebar/components/resizable-sidebar'
import { Button } from '~/features/shadcn/components/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'

export function RightSidebarContainer() {
  const { item } = useCurrentItem()
  const sidebar = useRightSidebar()

  const prevItemIdRef = useRef(item?._id)
  useEffect(() => {
    if (prevItemIdRef.current !== item?._id) {
      prevItemIdRef.current = item?._id
      sidebar.close()
    }
  }, [sidebar, item?._id])

  if (!item) return null

  const isNote = item.type === SIDEBAR_ITEM_TYPES.notes
  const activeContentId = isNote ? sidebar.activeContentId : RIGHT_SIDEBAR_CONTENT.history

  return (
    <>
      {isNote && !sidebar.visible && (
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
            activeContentId={activeContentId}
            onContentChange={sidebar.setActiveContent}
            onClose={sidebar.close}
          />
        </ResizableSidebar>
      )}
    </>
  )
}
