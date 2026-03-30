import { Link } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'

export function NotesNavButton() {
  const { dmUsername, campaignSlug } = useCampaign()
  const { lastSelectedItemSearch } = useLastEditorItem()

  return (
    <TooltipButton tooltip="Notes" side="right">
      <Link
        to="/campaigns/$dmUsername/$campaignSlug/editor"
        params={{ dmUsername, campaignSlug }}
        search={lastSelectedItemSearch}
        activeOptions={{ includeSearch: false }}
      >
        {({ isActive }) => (
          <Button
            variant={isActive ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="Notes"
          >
            <FileText className="h-4 w-4" />
          </Button>
        )}
      </Link>
    </TooltipButton>
  )
}
