import { describe, expect, it } from 'vitest'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import { resolveCampaignActor } from 'shared/campaigns/actor'
import { createCampaignMember } from '~/test/factories/campaign-factory'
import { testId } from '~/test/helpers/test-id'

const campaignId = testId<'campaigns'>('campaign_actor')
const otherCampaignId = testId<'campaigns'>('campaign_other')
const player = createCampaignMember({ campaignId, role: CAMPAIGN_MEMBER_ROLE.Player })

describe('resolveCampaignActor', () => {
  it('returns a DM view-as actor only when the selection belongs to the active campaign members', () => {
    expect(
      resolveCampaignActor({
        campaignId,
        isDm: true,
        viewAsPlayer: { campaignId, memberId: player._id },
        members: [player],
      }),
    ).toEqual({ kind: 'dm_view_as', campaignId, memberId: player._id })
  })

  it('rejects view-as state from another campaign', () => {
    expect(
      resolveCampaignActor({
        campaignId,
        isDm: true,
        viewAsPlayer: { campaignId: otherCampaignId, memberId: player._id },
        members: [player],
      }),
    ).toEqual({ kind: 'dm', campaignId })
  })

  it('rejects selected members that are not active players in the current campaign', () => {
    const removedPlayer = createCampaignMember({
      campaignId,
      role: CAMPAIGN_MEMBER_ROLE.Player,
      status: CAMPAIGN_MEMBER_STATUS.Removed,
    })
    const dmMember = createCampaignMember({ campaignId, role: CAMPAIGN_MEMBER_ROLE.DM })

    expect(
      resolveCampaignActor({
        campaignId,
        isDm: true,
        viewAsPlayer: { campaignId, memberId: removedPlayer._id },
        members: [removedPlayer],
      }),
    ).toEqual({ kind: 'dm', campaignId })
    expect(
      resolveCampaignActor({
        campaignId,
        isDm: true,
        viewAsPlayer: { campaignId, memberId: dmMember._id },
        members: [dmMember],
      }),
    ).toEqual({ kind: 'dm', campaignId })
  })

  it('models a non-DM campaign member as a player actor', () => {
    expect(
      resolveCampaignActor({
        campaignId,
        isDm: false,
        viewAsPlayer: { campaignId, memberId: player._id },
        members: [player],
      }),
    ).toEqual({ kind: 'player', campaignId })
  })
})
