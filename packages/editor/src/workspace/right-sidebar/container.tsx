import { List, X } from 'lucide-react'
import { RIGHT_SIDEBAR_CONTENT } from './content'
import { ResizableSidebar } from '@wizard-archive/ui/components/resizable-sidebar'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@wizard-archive/ui/shadcn/components/tooltip'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { getAvailableRightSidebarPanelsForItemType } from './registry'
import type { AnyItem } from '../items'
import type { RightSidebarContentId } from './content'
import { getRightSidebarAvailablePanels } from './source'
import { RightSidebarPanel } from './panels'
import type { RightSidebarSource } from './source'

export interface RightSidebarState {
  activeContentId: RightSidebarContentId | null
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
  sidebar,
  source,
}: {
  item: AnyItem | null
  sidebar: RightSidebarState
  source: RightSidebarSource
}) {
  const { activeContentId } = sidebar
  const availablePanels = item
    ? getAvailableRightSidebarPanelsForItemType(item.type, getRightSidebarAvailablePanels(source))
    : []
  const hasAvailablePanel = availablePanels.length > 0
  const activePanel =
    availablePanels.find((panel) => panel.id === activeContentId) ?? availablePanels[0]
  const canOpenOutline = availablePanels.some((panel) => panel.id === RIGHT_SIDEBAR_CONTENT.outline)

  if (!item) return null

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
      {sidebar.visible && hasAvailablePanel && (
        <ResizableSidebar
          side="right"
          size={sidebar.size}
          visible={sidebar.visible}
          onSizeChange={sidebar.setSize}
          onVisibleChange={sidebar.setVisible}
          isLoaded={sidebar.isLoaded}
          minWidth={200}
        >
          <div className="flex flex-col h-full bg-background">
            <div className="flex items-center justify-between px-1 py-0.5 border-b border-border shrink-0">
              <div className="flex items-center gap-0.5">
                {availablePanels.map((panel) => (
                  <Tooltip key={panel.id}>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label={panel.label}
                          aria-pressed={activePanel.id === panel.id}
                          className={cn(
                            'inline-flex size-6 items-center justify-center rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors',
                            activePanel.id === panel.id
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground',
                          )}
                          onClick={() => sidebar.setActiveContent(panel.id)}
                        />
                      }
                    >
                      <panel.icon className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{panel.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={sidebar.close}
                aria-label="Close sidebar"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <RightSidebarPanel contentId={activePanel.id} itemId={item.id} source={source} />
            </div>
          </div>
        </ResizableSidebar>
      )}
    </>
  )
}
