import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { CampaignPanelContent } from './campaign-panel-content'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@wizard-archive/ui/shadcn/components/popover'
import type { CampaignPanelSource } from './campaign-panel-source'
import { getSessionStatusDotColor } from './session-status-dot'

export function CampaignPanel({
  onSwitchCampaign,
  source,
  workspaceControls,
}: {
  onSwitchCampaign: () => void
  source: CampaignPanelSource
  workspaceControls?: ReactNode
}) {
  const [open, setOpen] = useState(false)

  const hasActiveSession = !!source.currentSession

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/70 cursor-pointer"
          >
            <span className="flex-1 truncate text-sm font-medium">{source.campaignName}</span>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${getSessionStatusDotColor({
                hasActiveSession,
                isLoadingSessions: source.isLoadingSessions,
              })}`}
            />
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent side="right" sideOffset={8} align="end" className="p-0 w-64">
        <CampaignPanelContent
          source={source}
          workspaceControls={workspaceControls}
          onClose={() => setOpen(false)}
          onSwitchCampaign={onSwitchCampaign}
        />
      </PopoverContent>
    </Popover>
  )
}
