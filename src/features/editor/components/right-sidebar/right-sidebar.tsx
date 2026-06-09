import { X } from 'lucide-react'
import type { RightSidebarContentId } from '~/features/editor/chrome/right-sidebar-content'
import type { Id } from 'convex/_generated/dataModel'
import { getRightSidebarPanelsForItemType } from './right-sidebar-registry'
import type { RightSidebarPanelServices } from './right-sidebar-panel-source'
import type { RightSidebarItemType } from './right-sidebar-model'
import { Button } from '~/features/shadcn/components/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'
import { cn } from '~/features/shadcn/lib/utils'

export function RightSidebar({
  itemId,
  itemType,
  activeContentId,
  onContentChange,
  onClose,
  panelServices,
}: {
  itemId: Id<'sidebarItems'>
  itemType: RightSidebarItemType
  activeContentId: RightSidebarContentId
  onContentChange: (contentId: RightSidebarContentId) => void
  onClose: () => void
  panelServices: RightSidebarPanelServices
}) {
  const tabs = getRightSidebarPanelsForItemType(itemType)
  const ActivePanel = panelServices[activeContentId]

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-1 py-0.5 border-b border-border shrink-0">
        <div className="flex items-center gap-0.5">
          {tabs.map((tab) => (
            <Tooltip key={tab.id}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={tab.label}
                    className={cn(
                      'inline-flex size-6 items-center justify-center rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors',
                      activeContentId === tab.id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground',
                    )}
                    onClick={() => onContentChange(tab.id)}
                  />
                }
              >
                <tab.icon className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="bottom">{tab.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0">
        <ActivePanel itemId={itemId} />
      </div>
    </div>
  )
}
