import { Eye, X } from 'lucide-react'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import { Banner, BannerButton } from '~/shared/components/banner'
import { getCampaignMemberDisplayName } from '~/shared/utils/user-display-name'

export function ViewAsBanner() {
  const { viewAsPlayerId, setViewAsPlayerId } = useEditorMode()
  const campaignMembersQuery = useCampaignMembers()

  const playerMember = campaignMembersQuery.data?.find(
    (member) => member._id === viewAsPlayerId && member.role === CAMPAIGN_MEMBER_ROLE.Player,
  )

  const displayName = playerMember ? getCampaignMemberDisplayName(playerMember) : null

  const isActive = !!(viewAsPlayerId && displayName)

  return (
    <>
      {isActive && (
        <div className="fixed inset-0 z-50 pointer-events-none border-[3px] border-primary/60 dark:border-primary/70" />
      )}

      {isActive && (
        <div className="overflow-hidden">
          <Banner
            icon={<Eye className="size-3.5" />}
            variant="accent"
            border="top"
            actions={
              <BannerButton onClick={() => setViewAsPlayerId(undefined)}>
                <X className="mr-0.5 size-3" />
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
