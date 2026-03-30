import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import type { ReactNode } from 'react'
import { CampaignsContent } from '~/features/campaigns/components/campaigns-content'
import { createCampaign } from '~/test/factories/campaign-factory'
import { mockAuthQuery, mockAuthQueryError } from '~/test/mocks/convex-mocks'
import { TestWrapper } from '~/test/test-wrapper'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
  useSearch: () => ({}),
  useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  Link: ({
    children,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) =>
    createElement('a', { href: props.to, ...props }, children),
  useRouter: () => ({ navigate: vi.fn() }),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: vi.fn(),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isIdle: true,
    isSuccess: false,
    isError: false,
    status: 'idle',
    data: undefined,
    error: null,
    reset: vi.fn(),
  }),
}))

describe('CampaignsContent', () => {
  it('renders loading skeleton when query is pending', () => {
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery(undefined))

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    expect(screen.getByTestId('campaigns-loading-skeleton')).toBeInTheDocument()
  })

  it('renders error state when query fails', () => {
    vi.mocked(useAuthQuery).mockReturnValue(
      mockAuthQueryError(new Error('Failed')),
    )

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    expect(screen.getByText('Error Loading Campaigns')).toBeInTheDocument()
  })

  it('renders empty state when no campaigns exist', () => {
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery([]))

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    expect(screen.getByText(/no campaigns yet/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create your first campaign/i }),
    ).toBeInTheDocument()
  })

  it('renders campaign cards with correct data', () => {
    const campaign = createCampaign({
      name: 'Dragon Quest',
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })

    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery([campaign]))

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    expect(screen.getByText('Dragon Quest')).toBeInTheDocument()
  })

  it('shows edit and delete buttons for DM campaigns', () => {
    const campaign = createCampaign({
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })

    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery([campaign]))

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    expect(
      screen.getByRole('button', { name: /edit campaign/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /delete campaign/i }),
    ).toBeInTheDocument()
  })

  it('hides edit and delete buttons for player campaigns', () => {
    const campaign = createCampaign({
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.Player },
    })

    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery([campaign]))

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    expect(
      screen.queryByRole('button', { name: /edit campaign/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /delete campaign/i }),
    ).not.toBeInTheDocument()
  })
})
