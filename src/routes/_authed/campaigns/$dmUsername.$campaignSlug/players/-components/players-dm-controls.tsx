import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
} from 'convex/campaigns/types'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { convexQuery } from '@convex-dev/react-query'
import { Button } from '~/components/shadcn/ui/button'
import { useCampaign } from '~/hooks/useCampaign'
import { CopyField } from '~/components/copy-field'
import { getOrigin } from '~/utils/origin'

type PlayersDmControlsProps = {
  onOpenRequests?: () => void
  onCopyJoinUrl?: () => void
}

export default function PlayersDmControls({
  onOpenRequests,
  onCopyJoinUrl,
}: PlayersDmControlsProps) {
  const { dmUsername, campaignSlug, campaignWithMembership, isDm } =
    useCampaign()
  const campaign = campaignWithMembership.data?.campaign
  const campaignMember = campaignWithMembership.data?.member
  const players = useQuery(
    convexQuery(
      api.campaigns.queries.getPlayersByCampaign,
      campaign?._id ? { campaignId: campaign._id } : 'skip',
    ),
  )

  const joinUrl = `${getOrigin()}/join/${dmUsername}/${campaignSlug}`

  const pendingCount = (players.data ?? []).filter(
    (p) =>
      p.role === CAMPAIGN_MEMBER_ROLE.Player &&
      p.status === CAMPAIGN_MEMBER_STATUS.Pending,
  ).length

  if (!isDm) {
    return null
  }

  return (
    <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <CopyField
        className="bg-slate-100"
        text={joinUrl}
        placeholder="Join URL not configured"
        onCopy={onCopyJoinUrl}
      />
      <div className="relative inline-flex w-fit shrink-0 self-start md:self-auto">
        <Button
          variant="outline"
          disabled={
            campaignWithMembership.status === 'pending' ||
            campaignMember?.role !== CAMPAIGN_MEMBER_ROLE.DM
          }
          onClick={onOpenRequests}
        >
          Manage Requests
        </Button>
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center">
            {pendingCount}
          </span>
        )}
      </div>
    </div>
  )
}
