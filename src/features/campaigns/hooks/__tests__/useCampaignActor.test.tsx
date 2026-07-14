import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import { useCampaignActor } from '../useCampaignActor'
import { testId } from '~/test/helpers/test-id'
import { testCampaignId } from 'shared/test/campaign-id'
import { testCampaignMemberId } from 'shared/test/campaign-member-id'
import type { CampaignViewAsSelection } from 'shared/campaigns/actor'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'

const campaignId = testCampaignId('campaign_actor')
const otherCampaignId = testCampaignId('campaign_other')
const playerId = testCampaignMemberId('player_1')

const campaignState = vi.hoisted(() => ({
  campaignId: undefined as CampaignId | undefined,
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

vi.mock('~/features/campaigns/state/campaign-view-as-store', () => ({
  useCampaignViewAsStore: (selector: (state: typeof viewAsState) => unknown) =>
    selector(viewAsState),
}))

describe('useCampaignActor', () => {
  beforeEach(() => {
    campaignState.campaignId = campaignId
    campaignState.isDm = true
    membersState.data = [campaignMember({ id: playerId, campaignId })]
    viewAsState.viewAsPlayer = null
    viewAsState.setViewAsPlayer.mockReset()
  })

  it('returns a validated view-as actor for the current campaign member', () => {
    viewAsState.viewAsPlayer = { campaignId, memberId: playerId }

    const { result } = renderHook(() => useCampaignActor())

    expect(result.current).toEqual({ kind: 'dm_view_as', campaignId, memberId: playerId })
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
  overrides: Partial<CampaignMemberSummary> & Pick<CampaignMemberSummary, 'id' | 'campaignId'>,
): CampaignMemberSummary {
  const { id, campaignId: memberCampaignId, ...rest } = overrides
  return {
    id,
    createdAt: 1,
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
