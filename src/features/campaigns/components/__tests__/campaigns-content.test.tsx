import { createElement } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { fireEvent, render, screen } from '@testing-library/react'
import { usePaginatedQuery } from 'convex/react'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import type { ReactNode } from 'react'
import { CampaignsContent } from '~/features/campaigns/components/campaigns-content'
import { createCampaign } from '~/test/factories/campaign-factory'
import { TestWrapper } from '~/test/test-wrapper'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
  useSearch: () => ({}),
  useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  Link: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
    createElement('a', { href: props.to, ...props }, children),
  useRouter: () => ({ navigate: vi.fn() }),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  usePaginatedQuery: vi.fn(),
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
    vi.mocked(usePaginatedQuery).mockReturnValue({
      isLoading: true,
      loadMore: vi.fn(),
      results: [],
      status: 'LoadingFirstPage',
    })

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    expect(screen.getByTestId('campaigns-loading-skeleton')).toBeInTheDocument()
  })

  it('renders error state when query fails', () => {
    vi.mocked(usePaginatedQuery).mockImplementation(() => {
      throw new Error('Failed')
    })

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    expect(screen.getByText('Error Loading Campaigns')).toBeInTheDocument()
  })

  it('renders empty state when no campaigns exist', () => {
    mockCampaignPage([])

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    expect(screen.getByText(/no campaigns yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create your first campaign/i })).toBeInTheDocument()
  })

  it('renders campaign cards with correct data', () => {
    const campaign = createCampaign({
      name: 'Dragon Quest',
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })

    mockCampaignPage([campaign])

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

    mockCampaignPage([campaign])

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    expect(screen.getByRole('button', { name: /edit campaign/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete campaign/i })).toBeInTheDocument()
  })

  it('hides edit and delete buttons for player campaigns', () => {
    const campaign = createCampaign({
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.Player },
    })

    mockCampaignPage([campaign])

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    expect(screen.queryByRole('button', { name: /edit campaign/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete campaign/i })).not.toBeInTheDocument()
  })

  it('offers explicit continuation for an incomplete campaign page', () => {
    const loadMore = vi.fn()
    mockCampaignPage([createCampaign({ name: 'First page' })], 'CanLoadMore', loadMore)

    render(
      <TestWrapper>
        <CampaignsContent />
      </TestWrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Load more campaigns' }))
    expect(loadMore).toHaveBeenCalledWith(24)
  })
})

function mockCampaignPage(
  results: Array<ReturnType<typeof createCampaign>>,
  status: 'CanLoadMore' | 'Exhausted' = 'Exhausted',
  loadMore = vi.fn(),
) {
  vi.mocked(usePaginatedQuery).mockReturnValue({ isLoading: false, loadMore, results, status })
}
