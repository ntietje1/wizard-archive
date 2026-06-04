import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import { useCampaignActor } from '../useCampaignActor'
import { testId } from '~/test/helpers/test-id'
import type { CampaignViewAsSelection } from 'shared/campaigns/actor'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'

const campaignId = testId<'campaigns'>('campaign_actor')
const otherCampaignId = testId<'campaigns'>('campaign_other')
const playerId = testId<'campaignMembers'>('player_1')

const campaignState = vi.hoisted(() => ({
  campaignId: 'campaign_actor' as Id<'campaigns'> | undefined,
  isDm: true as boolean | undefined,
}))
const membersState = vi.hoisted(() => ({
  data: [] as Array<CampaignMemberSummary> | undefined,
}))
const viewAsState = vi.hoisted(() => ({
  viewAsPlayer: null as CampaignViewAsSelection | null,
  setViewAsPlayer: vi.fn(),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => campaignState,
}))

vi.mock('~/features/campaigns/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => membersState,
}))

vi.mock('~/features/sidebar/stores/sidebar-ui-store', () => ({
  useSidebarUIStore: (selector: (state: typeof viewAsState) => unknown) => selector(viewAsState),
}))

describe('useCampaignActor', () => {
  beforeEach(() => {
    campaignState.campaignId = campaignId
    campaignState.isDm = true
    membersState.data = [campaignMember({ _id: playerId, campaignId })]
    viewAsState.viewAsPlayer = null
    viewAsState.setViewAsPlayer.mockReset()
  })

  it('returns a validated view-as actor for the current campaign member', () => {
    viewAsState.viewAsPlayer = { campaignId, memberId: playerId }

    const { result } = renderHook(() => useCampaignActor())

    expect(result.current).toEqual({ kind: 'dm_view_as', campaignId, memberId: playerId })
    expect(viewAsState.setViewAsPlayer).not.toHaveBeenCalled()
  })

  it('clears view-as state that belongs to another campaign', async () => {
    viewAsState.viewAsPlayer = { campaignId: otherCampaignId, memberId: playerId }

    const { result } = renderHook(() => useCampaignActor())

    expect(result.current).toEqual({ kind: 'dm', campaignId })
    await waitFor(() => {
      expect(viewAsState.setViewAsPlayer).toHaveBeenCalledExactlyOnceWith(null)
    })
  })
})

function campaignMember(
  overrides: Partial<CampaignMemberSummary> & Pick<CampaignMemberSummary, '_id' | 'campaignId'>,
): CampaignMemberSummary {
  const { _id, campaignId: memberCampaignId, ...rest } = overrides
  return {
    _id,
    _creationTime: 1,
    userId: testId<'userProfiles'>('user_1'),
    campaignId: memberCampaignId,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    userProfile: {
      name: 'Mina',
      username: 'mina' as never,
      imageUrl: null,
    },
    ...rest,
  }
}
