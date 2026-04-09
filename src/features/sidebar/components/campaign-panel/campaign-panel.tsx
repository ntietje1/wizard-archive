import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { CampaignPanelContent } from './campaign-panel-content'
import { Popover, PopoverContent, PopoverTrigger } from '~/features/shadcn/components/popover'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSession } from '~/features/sidebar/hooks/useGameSession'

export function CampaignPanel() {
  const [open, setOpen] = useState(false)
  const { campaign } = useCampaign()
  const { currentSession } = useSession()

  const hasActiveSession = !!currentSession.data
  const campaignName = campaign.data?.name ?? 'Campaign'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/70 cursor-pointer"
          >
            <span className="flex-1 truncate text-sm font-medium">{campaignName}</span>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${hasActiveSession ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            />
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent side="right" sideOffset={8} align="end" className="p-0 w-64">
        <CampaignPanelContent onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
