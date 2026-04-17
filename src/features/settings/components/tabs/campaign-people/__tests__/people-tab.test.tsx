import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { assertUsername } from 'convex/users/validation'
import { PeopleTab } from '~/features/settings/components/tabs/campaign-people/people-tab'
import { useOptionalCampaign } from '~/features/campaigns/hooks/useCampaign'
import { createCampaign } from '~/test/factories/campaign-factory'
import { mockAuthQuery } from '~/test/mocks/convex-mocks'
import { TestWrapper } from '~/test/test-wrapper'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useOptionalCampaign: vi.fn(),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: vi.fn(),
}))

describe('PeopleTab', () => {
  it('renders on campaign routes without requiring CampaignProvider', () => {
    const campaign = createCampaign({
      slug: 'my-campaign',
    })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      dmUsername: assertUsername('testdm'),
      campaignSlug: campaign.slug,
      campaign: mockAuthQuery(campaign),
      isDm: false,
      isCampaignLoaded: true,
      campaignId: campaign._id,
    })
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery(undefined))

    render(
      <TestWrapper>
        <PeopleTab />
      </TestWrapper>,
    )

    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument()
    expect(vi.mocked(useAuthQuery)).toHaveBeenCalled()
  })

  it('shows a fallback message when no campaign route is active', () => {
    vi.mocked(useOptionalCampaign).mockReturnValue(null)
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery(undefined))

    render(
      <TestWrapper>
        <PeopleTab />
      </TestWrapper>,
    )

    expect(screen.getByText(/open a campaign to manage players/i)).toBeInTheDocument()
  })
})
