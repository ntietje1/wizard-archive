import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import type { ReactNode } from 'react'
import { CampaignProvider } from '~/features/campaigns/contexts/campaign-context'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { createCampaign } from '~/test/factories/campaign-factory'
import { mockAuthQuery, mockAuthQueryError } from '~/test/mocks/convex-mocks'
import { TestWrapper } from '~/test/test-wrapper'

import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

const mockUseMatch = vi.fn()

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useMatch: (...args: Array<unknown>) => mockUseMatch(...args),
  useNavigate: () => vi.fn(),
  useParams: () => ({
    dmUsername: 'testdm',
    campaignSlug: 'my-campaign',
  }),
  useSearch: () => ({}),
  useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  Link: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
    createElement('a', { href: props.to, ...props }, children),
  useRouter: () => ({ navigate: vi.fn() }),
}))

function CampaignConsumer() {
  const ctx = useCampaign()
  return (
    <div>
      <span data-testid="dm-username">{ctx.dmUsername}</span>
      <span data-testid="campaign-slug">{ctx.campaignSlug}</span>
      <span data-testid="is-dm">{String(ctx.isDm)}</span>
      <span data-testid="is-loaded">{String(ctx.isCampaignLoaded)}</span>
    </div>
  )
}

describe('CampaignProvider', () => {
  beforeEach(() => {
    mockUseMatch.mockReturnValue({
      params: {
        dmUsername: 'testdm',
        campaignSlug: 'my-campaign',
      },
    })
  })

  it('provides campaign data to children', () => {
    const campaign = createCampaign({
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery(campaign))

    render(
      <TestWrapper>
        <CampaignProvider>
          <CampaignConsumer />
        </CampaignProvider>
      </TestWrapper>,
    )

    expect(screen.getByTestId('dm-username')).toHaveTextContent('testdm')
    expect(screen.getByTestId('campaign-slug')).toHaveTextContent('my-campaign')
    expect(screen.getByTestId('is-loaded')).toHaveTextContent('true')
  })

  it('sets isDm to true when role is DM', () => {
    const campaign = createCampaign({
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery(campaign))

    render(
      <TestWrapper>
        <CampaignProvider>
          <CampaignConsumer />
        </CampaignProvider>
      </TestWrapper>,
    )

    expect(screen.getByTestId('is-dm')).toHaveTextContent('true')
  })

  it('sets isDm to false when role is Player', () => {
    const campaign = createCampaign({
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.Player },
    })
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery(campaign))

    render(
      <TestWrapper>
        <CampaignProvider>
          <CampaignConsumer />
        </CampaignProvider>
      </TestWrapper>,
    )

    expect(screen.getByTestId('is-dm')).toHaveTextContent('false')
  })

  it('sets isDm to false when campaign has no membership', () => {
    const campaign = createCampaign({ myMembership: null })
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery(campaign))

    render(
      <TestWrapper>
        <CampaignProvider>
          <CampaignConsumer />
        </CampaignProvider>
      </TestWrapper>,
    )

    expect(screen.getByTestId('is-dm')).toHaveTextContent('false')
  })

  it('reports not loaded while query is pending', () => {
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery(undefined))

    render(
      <TestWrapper>
        <CampaignProvider>
          <CampaignConsumer />
        </CampaignProvider>
      </TestWrapper>,
    )

    expect(screen.getByTestId('is-loaded')).toHaveTextContent('false')
  })

  it('does not render children on query error', () => {
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQueryError(new Error('Not found')))

    render(
      <TestWrapper>
        <CampaignProvider>
          <CampaignConsumer />
        </CampaignProvider>
      </TestWrapper>,
    )

    expect(screen.queryByTestId('dm-username')).not.toBeInTheDocument()
  })
})
