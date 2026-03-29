import { Link } from '@tanstack/react-router'
import { PictureInPicture2 } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function SceneNavButton() {
  const { dmUsername, campaignSlug } = useCampaign()

  return (
    <TooltipButton tooltip="Scene" side="right">
      <Link
        to="/campaigns/$dmUsername/$campaignSlug/scene"
        params={{ dmUsername, campaignSlug }}
      >
        {({ isActive }) => (
          <Button
            variant={isActive ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="Scene"
          >
            <PictureInPicture2 className="h-4 w-4" />
          </Button>
        )}
      </Link>
    </TooltipButton>
  )
}
