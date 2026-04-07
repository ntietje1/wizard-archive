import { ArrowUpLeft, ArrowUpRight, History, List, X } from 'lucide-react'
import { RIGHT_SIDEBAR_CONTENT } from './constants'
import { HistoryPanel } from './history-panel'
import { BackLinksPanel } from './back-links-panel'
import { OutgoingLinksPanel } from './outgoing-links-panel'
import { OutlinePanel } from './outline-panel'
import type { RightSidebarContentId } from './constants'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { Button } from '~/features/shadcn/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/features/shadcn/components/tooltip'
import { cn } from '~/features/shadcn/lib/utils'

const TABS = [
  {
    id: RIGHT_SIDEBAR_CONTENT.history,
    label: 'History',
    icon: History,
  },
  {
    id: RIGHT_SIDEBAR_CONTENT.backlinks,
    label: 'Back Links',
    icon: ArrowUpLeft,
  },
  {
    id: RIGHT_SIDEBAR_CONTENT.outgoing,
    label: 'Outgoing Links',
    icon: ArrowUpRight,
  },
  {
    id: RIGHT_SIDEBAR_CONTENT.outline,
    label: 'Outline',
    icon: List,
  },
] as const

function PanelContent({
  contentId,
  itemId,
}: {
  contentId: RightSidebarContentId
  itemId: SidebarItemId
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
  }
}

export function RightSidebar({
  itemId,
  activeContentId,
  onContentChange,
  onClose,
}: {
  itemId: SidebarItemId
  activeContentId: RightSidebarContentId
  onContentChange: (contentId: string) => void
  onClose: () => void
}) {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-1 py-0.5 border-b border-border shrink-0">
        <div className="flex items-center gap-0.5">
          {TABS.map((tab) => (
            <Tooltip key={tab.id}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center justify-center h-6 w-6 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors',
                      activeContentId === tab.id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground',
                    )}
                    onClick={() => onContentChange(tab.id)}
                  />
                }
              >
                <tab.icon className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent side="bottom">{tab.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0">
        <PanelContent contentId={activeContentId} itemId={itemId} />
      </div>
    </div>
  )
}
