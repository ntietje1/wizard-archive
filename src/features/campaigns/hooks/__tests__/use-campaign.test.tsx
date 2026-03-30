import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import type { ReactNode } from 'react'
import type { CampaignContextType } from '~/features/campaigns/hooks/useCampaign'
import {
  CampaignContext,
  useCampaign,
} from '~/features/campaigns/hooks/useCampaign'
import { mockAuthQuery } from '~/test/mocks/convex-mocks'
import { createCampaign } from '~/test/factories/campaign-factory'

function createWrapper(value: CampaignContextType) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <CampaignContext.Provider value={value}>
        {children}
      </CampaignContext.Provider>
    )
  }
}

describe('useCampaign', () => {
  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useCampaign())
    }).toThrow('useCampaign must be used within a CampaignProvider')
  })

  it('returns context value when inside provider', () => {
    const campaign = createCampaign()
    const value: CampaignContextType = {
      dmUsername: 'testdm',
      campaignSlug: campaign.slug,
      campaign: mockAuthQuery(campaign),
      isDm: true,
      isCampaignLoaded: true,
      campaignId: campaign._id,
    }

    const { result } = renderHook(() => useCampaign(), {
      wrapper: createWrapper(value),
    })
    expect(result.current.dmUsername).toBe('testdm')
    expect(result.current.isDm).toBe(true)
    expect(result.current.campaignId).toBe(campaign._id)
  })

  it('returns isDm true from context', () => {
    const campaign = createCampaign({
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })
    const value: CampaignContextType = {
      dmUsername: 'dm',
      campaignSlug: campaign.slug,
      campaign: mockAuthQuery(campaign),
      isDm: true,
      isCampaignLoaded: true,
      campaignId: campaign._id,
    }

    const { result } = renderHook(() => useCampaign(), {
      wrapper: createWrapper(value),
    })
    expect(result.current.isDm).toBe(true)
  })

  it('returns isDm false from context', () => {
    const campaign = createCampaign({
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.Player },
    })
    const value: CampaignContextType = {
      dmUsername: 'dm',
      campaignSlug: campaign.slug,
      campaign: mockAuthQuery(campaign),
      isDm: false,
      isCampaignLoaded: true,
      campaignId: campaign._id,
    }

    const { result } = renderHook(() => useCampaign(), {
      wrapper: createWrapper(value),
    })
    expect(result.current.isDm).toBe(false)
  })
})
