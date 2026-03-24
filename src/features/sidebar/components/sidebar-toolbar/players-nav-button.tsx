import { Link } from '@tanstack/react-router'
import { Users } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function PlayersNavButton() {
  const { dmUsername, campaignSlug } = useCampaign()

  return (
    <TooltipButton tooltip="Players" side="right">
      <Link
        to="/campaigns/$dmUsername/$campaignSlug/players"
        params={{ dmUsername, campaignSlug }}
        activeOptions={{ includeSearch: false }}
      >
        {({ isActive }) => (
          <Button variant={isActive ? 'secondary' : 'ghost'} size="icon">
            <Users className="h-4 w-4" />
          </Button>
        )}
      </Link>
    </TooltipButton>
  )
}
