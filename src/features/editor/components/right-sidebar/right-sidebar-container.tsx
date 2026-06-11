import { List } from 'lucide-react'
import { RIGHT_SIDEBAR_CONTENT } from '~/features/editor/chrome/right-sidebar-content'
import { RightSidebar } from './right-sidebar'
import { ResizableSidebar } from '~/features/sidebar/components/resizable-sidebar'
import { Button } from '~/features/shadcn/components/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'
import { canShowRightSidebarContent } from './right-sidebar-model'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { RightSidebarContentId } from '~/features/editor/chrome/right-sidebar-content'
import type { RightSidebarPanelServices } from './right-sidebar-panel-source'

interface RightSidebarState {
  activeContentId: RightSidebarContentId
  close: () => void
  isLoaded: boolean
  open: (contentId: RightSidebarContentId) => void
  setActiveContent: (contentId: RightSidebarContentId) => void
  setSize: (size: number) => void
  setVisible: (visible: boolean) => void
  size: number
  visible: boolean
}

export function RightSidebarContainer({
  item,
  panelServices,
  sidebar,
}: {
  item: AnySidebarItem | null
  panelServices: RightSidebarPanelServices
  sidebar: RightSidebarState
}) {
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
            panelServices={panelServices}
          />
        </ResizableSidebar>
      )}
    </>
  )
}
