import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { testId } from '~/test/helpers/test-id'
import { useCampaignViewAsStore } from '../campaign-view-as-store'

beforeEach(() => {
  useCampaignViewAsStore.setState({ viewAsPlayer: null })
})

describe('useCampaignViewAsStore', () => {
  it('stores the selected campaign player view', () => {
    const campaignId = testId<'campaigns'>('campaign_view')
    const memberId = testId<'campaignMembers'>('member_view')

    useCampaignViewAsStore.getState().setViewAsPlayer({ campaignId, memberId })

    expect(useCampaignViewAsStore.getState().viewAsPlayer).toEqual({
      campaignId,
      memberId,
    })
  })

  it('clears the selected campaign player view', () => {
    useCampaignViewAsStore.getState().setViewAsPlayer({
      campaignId: testId<'campaigns'>('campaign_view'),
      memberId: testId<'campaignMembers'>('member_view'),
    })

    useCampaignViewAsStore.getState().setViewAsPlayer(null)

    expect(useCampaignViewAsStore.getState().viewAsPlayer).toBeNull()
  })
})
