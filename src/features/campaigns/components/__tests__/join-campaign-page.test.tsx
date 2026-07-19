import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { fireEvent, render, screen } from '@testing-library/react'
import { ERROR_CODE } from 'shared/errors/client'
import type { ReactNode } from 'react'
import { JoinCampaignPage } from '~/features/campaigns/components/join-campaign-page'
import { createCampaign } from '~/test/factories/campaign-factory'
import { clientError } from '~/test/factories/error-factory'
import { mockAppMutation, mockAuthQuery, mockAuthQueryError } from '~/test/mocks/convex-mocks'
import { TestWrapper } from '~/test/test-wrapper'
import type * as TanstackReactQuery from '@tanstack/react-query'
import { testDomainId } from 'shared/test/domain-id'

const campaignId = testDomainId('campaign', 'join_campaign')

const mockNavigate = vi.fn()
const mockUseQuery = vi.fn()
const mockUseConvexAuth = vi.fn()
const mockUseAppMutation = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({
    campaignId,
  }),
  useSearch: () => ({}),
  useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  Link: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
    createElement('a', { href: props.to, ...props }, children),
  ClientOnly: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  useRouter: () => ({ navigate: vi.fn() }),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof TanstackReactQuery>()),
  useQuery: (...args: Array<unknown>) => mockUseQuery(...args),
}))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: vi.fn(() => ({ queryKey: ['campaign'], queryFn: vi.fn() })),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => mockUseConvexAuth(),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => mockUseAppMutation(),
}))

describe('JoinCampaignPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockUseQuery.mockReset()
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    mockUseAppMutation.mockReturnValue(mockAppMutation())
    mockUseQuery.mockReturnValue(mockAuthQuery(createCampaign()))
  })

  it('renders not found for missing campaign errors', () => {
    mockUseQuery.mockReturnValue(
      mockAuthQuery(undefined, {
        status: 'error',
        isPending: false,
        isLoading: false,
        isError: true,
        error: clientError(ERROR_CODE.NOT_FOUND),
        isFetching: false,
        fetchStatus: 'idle',
      }),
    )

    render(
      <TestWrapper>
        <JoinCampaignPage />
      </TestWrapper>,
    )

    expect(screen.getByText('Campaign Not Found')).toBeInTheDocument()
    expect(screen.queryByText('Could Not Load Campaign')).not.toBeInTheDocument()
  })

  it('renders a retryable failure for unexpected campaign lookup errors', () => {
    const refetch = vi.fn()
    mockUseQuery.mockReturnValue(
      mockAuthQueryError(new Error('Network failed'), {
        refetch,
      }),
    )

    render(
      <TestWrapper>
        <JoinCampaignPage />
      </TestWrapper>,
    )

    expect(screen.getByText('Could Not Load Campaign')).toBeInTheDocument()
    expect(screen.queryByText('Campaign Not Found')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(refetch).toHaveBeenCalled()
  })
})
