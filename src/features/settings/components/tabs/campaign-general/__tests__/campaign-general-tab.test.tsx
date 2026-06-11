import { fireEvent, render, screen } from '@testing-library/react'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { assertUsername } from 'shared/users/validation'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CampaignGeneralTab } from '~/features/settings/components/tabs/campaign-general/campaign-general-tab'
import { useOptionalCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { createCampaign } from '~/test/factories/campaign-factory'
import { mockAuthQuery } from '~/test/mocks/convex-mocks'
import { TestWrapper } from '~/test/test-wrapper'

const mutateAsync = vi.fn()

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useOptionalCampaign: vi.fn(),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: vi.fn(),
}))

describe('CampaignGeneralTab', () => {
  beforeEach(() => {
    vi.mocked(useOptionalCampaign).mockReset()
    vi.mocked(useAppMutation).mockReset()
    mutateAsync.mockReset()
    vi.mocked(useAppMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      variables: undefined,
    } as never)
  })

  it('shows the current new-folder share default', () => {
    const campaign = createCampaign({
      defaultFolderInheritShares: true,
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      dmUsername: assertUsername('testdm'),
      campaignSlug: campaign.slug,
      campaign: mockAuthQuery(campaign),
      isDm: true,
      isCampaignLoaded: true,
      campaignId: campaign._id,
    })

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    expect(
      screen.getByRole('switch', { name: /share folder contents automatically/i }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('updates the campaign default when the switch changes', () => {
    const campaign = createCampaign({
      defaultFolderInheritShares: false,
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      dmUsername: assertUsername('testdm'),
      campaignSlug: campaign.slug,
      campaign: mockAuthQuery(campaign),
      isDm: true,
      isCampaignLoaded: true,
      campaignId: campaign._id,
    })

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    fireEvent.click(screen.getByRole('switch', { name: /share folder contents automatically/i }))

    expect(mutateAsync).toHaveBeenCalledWith({
      campaignId: campaign._id,
      defaultFolderInheritShares: true,
    })
  })
})
