import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { assertUsername } from 'convex/users/validation'
import { PeopleTab } from '~/features/settings/components/tabs/campaign-people/people-tab'
import { useOptionalCampaign } from '~/features/campaigns/hooks/useCampaign'
import { createCampaign, createCampaignMember } from '~/test/factories/campaign-factory'
import { mockAuthQuery } from '~/test/mocks/convex-mocks'
import { TestWrapper } from '~/test/test-wrapper'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getOrigin } from '~/shared/utils/origin'

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useOptionalCampaign: vi.fn(),
}))

vi.mock(
  '~/features/settings/components/tabs/campaign-people/components/invite-link-section',
  () => ({
    InviteLinkSection: ({ joinUrl }: { joinUrl: string }) => (
      <div data-testid="invite-link-section">{joinUrl}</div>
    ),
  }),
)

vi.mock('~/features/settings/components/tabs/campaign-people/components/members-section', () => ({
  MembersSection: () => <div data-testid="members-section" />,
}))

vi.mock(
  '~/features/settings/components/tabs/campaign-people/components/pending-requests-section',
  () => ({
    PendingRequestsSection: () => <div data-testid="pending-requests-section" />,
  }),
)

vi.mock(
  '~/features/settings/components/tabs/campaign-people/components/rejected-removed-section',
  () => ({
    RejectedRemovedSection: () => <div data-testid="rejected-removed-section" />,
  }),
)

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: vi.fn(),
}))

vi.mock('~/shared/utils/origin', () => ({
  getOrigin: vi.fn(),
}))

describe('PeopleTab', () => {
  beforeEach(() => {
    vi.mocked(useOptionalCampaign).mockReset()
    vi.mocked(useAuthQuery).mockReset()
    vi.mocked(getOrigin).mockReset()
  })

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
    expect(screen.queryByTestId('members-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pending-requests-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rejected-removed-section')).not.toBeInTheDocument()
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
    expect(screen.queryByTestId('members-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pending-requests-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rejected-removed-section')).not.toBeInTheDocument()
  })

  it('renders the DM invite link for the active campaign', () => {
    const campaign = createCampaign({
      slug: 'my-campaign',
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
    vi.mocked(getOrigin).mockReturnValue('https://example.test')
    const readyMembers = [
      createCampaignMember({
        campaignId: campaign._id,
        role: CAMPAIGN_MEMBER_ROLE.DM,
      }),
    ]
    vi.mocked(useAuthQuery).mockImplementation((_query, args) => {
      if (args === 'skip') {
        return mockAuthQuery(undefined)
      }

      return mockAuthQuery(readyMembers)
    })

    render(
      <TestWrapper>
        <PeopleTab />
      </TestWrapper>,
    )

    expect(screen.getByTestId('invite-link-section')).toHaveTextContent(
      `https://example.test/join/testdm/${campaign.slug}`,
    )
    expect(screen.getByTestId('members-section')).toBeInTheDocument()
    expect(screen.getByTestId('pending-requests-section')).toBeInTheDocument()
    expect(screen.getByTestId('rejected-removed-section')).toBeInTheDocument()
  })
})
