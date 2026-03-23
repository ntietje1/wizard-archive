import { Eye, X } from 'lucide-react'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useCampaignMembers } from '~/features/players/hooks/useCampaignMembers'
import { Button } from '~/features/shadcn/components/button'

export function ViewAsBanner() {
  const { viewAsPlayerId, setViewAsPlayerId } = useEditorMode()
  const campaignMembersQuery = useCampaignMembers()

  const playerMember = campaignMembersQuery.data?.find(
    (member) =>
      member._id === viewAsPlayerId &&
      member.role === CAMPAIGN_MEMBER_ROLE.Player,
  )

  const displayName = playerMember
    ? playerMember.userProfile.name ||
      (playerMember.userProfile.username
        ? `@${playerMember.userProfile.username}`
        : 'Player')
    : null

  const isActive = !!(viewAsPlayerId && displayName)

  return (
    <>
      {/* Screen rim — fixed inset border around entire viewport */}
      {isActive && (
        <div className="fixed inset-0 z-50 pointer-events-none border-[3px] border-primary/60 dark:border-primary/70 fade-in-delayed-fast" />
      )}

      {/* Bottom banner */}
      {isActive && (
        <div className="overflow-hidden fade-in-delayed-fast">
          <div className="flex items-center justify-between px-3 h-8 border-t border-primary/40 bg-accent text-accent-foreground">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Eye className="h-3.5 w-3.5" />
              <span>
                Viewing as <span className="font-semibold">{displayName}</span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs text-accent-foreground hover:text-accent-foreground hover:bg-accent dark:text-primary dark:hover:text-primary dark:hover:bg-accent"
              onClick={() => setViewAsPlayerId(undefined)}
            >
              <X className="h-3 w-3 mr-0.5" />
              Exit
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
