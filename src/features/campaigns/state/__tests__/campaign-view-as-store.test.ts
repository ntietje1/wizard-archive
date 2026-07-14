import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { testCampaignId } from 'shared/test/campaign-id'
import { testCampaignMemberId } from 'shared/test/campaign-member-id'
import { useCampaignViewAsStore } from '../campaign-view-as-store'

beforeEach(() => {
  useCampaignViewAsStore.setState({ viewAsPlayer: null })
})

describe('useCampaignViewAsStore', () => {
  it('stores the selected campaign player view', () => {
    const campaignId = testCampaignId('campaign_view')
    const memberId = testCampaignMemberId('member_view')

    useCampaignViewAsStore.getState().setViewAsPlayer({ campaignId, memberId })

    expect(useCampaignViewAsStore.getState().viewAsPlayer).toEqual({
      campaignId,
      memberId,
    })
  })

  it('clears the selected campaign player view', () => {
    useCampaignViewAsStore.getState().setViewAsPlayer({
      campaignId: testCampaignId('campaign_view'),
      memberId: testCampaignMemberId('member_view'),
    })

    useCampaignViewAsStore.getState().setViewAsPlayer(null)

    expect(useCampaignViewAsStore.getState().viewAsPlayer).toBeNull()
  })
})
