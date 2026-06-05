import { X } from 'lucide-react'
import { RIGHT_SIDEBAR_CONTENT } from './constants'
import { HistoryPanel } from './history-panel'
import { BackLinksPanel } from './back-links-panel'
import { OutgoingLinksPanel } from './outgoing-links-panel'
import { OutlinePanel } from './outline-panel'
import type { RightSidebarContentId } from './constants'
import type { Id } from 'convex/_generated/dataModel'
import { getRightSidebarPanelsForItemType } from './right-sidebar-registry'
import type { RightSidebarItemType } from './right-sidebar-model'
import { Button } from '~/features/shadcn/components/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'
import { cn } from '~/features/shadcn/lib/utils'
import { assertNever } from '~/shared/utils/utils'

function PanelContent({
  contentId,
  itemId,
}: {
  contentId: RightSidebarContentId
  itemId: Id<'sidebarItems'>
}) {
  switch (contentId) {
    case RIGHT_SIDEBAR_CONTENT.history:
      return <HistoryPanel itemId={itemId} />
    case RIGHT_SIDEBAR_CONTENT.backlinks:
      return <BackLinksPanel itemId={itemId} />
    case RIGHT_SIDEBAR_CONTENT.outgoing:
      return <OutgoingLinksPanel itemId={itemId} />
    case RIGHT_SIDEBAR_CONTENT.outline:
      return <OutlinePanel itemId={itemId} />
    default: {
      const _exhaustiveCheck: never = contentId
      assertNever(_exhaustiveCheck)
    }
  }
}

export function RightSidebar({
  itemId,
  itemType,
  activeContentId,
  onContentChange,
  onClose,
}: {
  itemId: Id<'sidebarItems'>
  itemType: RightSidebarItemType
  activeContentId: RightSidebarContentId
  onContentChange: (contentId: RightSidebarContentId) => void
  onClose: () => void
}) {
  const tabs = getRightSidebarPanelsForItemType(itemType)

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
        <PanelContent contentId={activeContentId} itemId={itemId} />
      </div>
    </div>
  )
}
