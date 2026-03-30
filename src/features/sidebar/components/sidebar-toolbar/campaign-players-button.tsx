import { Users } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { useSettingsStore } from '~/features/settings/hooks/settings-store'

export function CampaignPlayersButton() {
  const openSettings = useSettingsStore((s) => s.open)

  return (
    <TooltipButton tooltip="Players" side="right">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Players"
        onClick={() => openSettings('campaign-people')}
      >
        <Users className="h-4 w-4" />
      </Button>
    </TooltipButton>
  )
}
