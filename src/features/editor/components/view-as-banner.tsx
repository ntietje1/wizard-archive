import { Eye, X } from 'lucide-react'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useCampaignMembers } from '~/features/players/hooks/useCampaignMembers'
import { Banner, BannerButton } from '~/shared/components/banner'

export function ViewAsBanner() {
  const { viewAsPlayerId, setViewAsPlayerId } = useEditorMode()
  const campaignMembersQuery = useCampaignMembers()

  const playerMember = campaignMembersQuery.data?.find(
    (member) => member._id === viewAsPlayerId && member.role === CAMPAIGN_MEMBER_ROLE.Player,
  )

  const displayName = playerMember
    ? playerMember.userProfile.name ||
      (playerMember.userProfile.username ? `@${playerMember.userProfile.username}` : 'Player')
    : null

  const isActive = !!(viewAsPlayerId && displayName)

  return (
    <>
      {isActive && (
        <div className="fixed inset-0 z-50 pointer-events-none border-[3px] border-primary/60 dark:border-primary/70 fade-in-delayed-fast" />
      )}

      {isActive && (
        <div className="overflow-hidden fade-in-delayed-fast">
          <Banner
            icon={<Eye className="h-3.5 w-3.5" />}
            variant="accent"
            border="top"
            actions={
              <BannerButton onClick={() => setViewAsPlayerId(undefined)}>
                <X className="h-3 w-3 mr-0.5" />
                Exit
              </BannerButton>
            }
          >
            Viewing as <span className="font-semibold">{displayName}</span>
          </Banner>
        </div>
      )}
    </>
  )
}
