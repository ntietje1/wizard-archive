import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { assertUsername } from 'convex/users/validation'
import type { ReactNode } from 'react'
import type { CampaignContextType } from '~/features/campaigns/hooks/useCampaign'
import {
  CampaignContext,
  useCampaign,
  useOptionalCampaign,
} from '~/features/campaigns/hooks/useCampaign'
import { mockAuthQuery } from '~/test/mocks/convex-mocks'
import { createCampaign } from '~/test/factories/campaign-factory'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

const mockUseMatch = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useMatch: (...args: Array<unknown>) => mockUseMatch(...args),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  useSearch: () => ({}),
  useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  Link: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
    createElement('a', { href: props.to, ...props }, children),
  useRouter: () => ({ navigate: vi.fn() }),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: vi.fn(),
}))

function createWrapper(value: CampaignContextType) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>
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
      dmUsername: assertUsername('testdm'),
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
      dmUsername: assertUsername('dm'),
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
      dmUsername: assertUsername('dm'),
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

describe('useOptionalCampaign', () => {
  beforeEach(() => {
    mockUseMatch.mockReset()
    vi.mocked(useAuthQuery).mockReset()
  })

  it('returns null when there is no provider or campaign route', () => {
    mockUseMatch.mockReturnValue(undefined)
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery(undefined))

    const { result } = renderHook(() => useOptionalCampaign())

    expect(result.current).toBeNull()
  })

  it('returns derived campaign state from the active campaign route', () => {
    const campaign = createCampaign({
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
      slug: 'my-campaign',
    })
    mockUseMatch.mockReturnValue({
      params: {
        dmUsername: 'testdm',
        campaignSlug: 'my-campaign',
      },
    })
    vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery(campaign))

    const { result } = renderHook(() => useOptionalCampaign())

    expect(result.current).toBeDefined()
    expect(result.current).not.toBeNull()
    const campaignContext = result.current
    if (!campaignContext) {
      throw new Error('Expected campaign context')
    }
    expect(campaignContext.dmUsername).toBe('testdm')
    expect(campaignContext.campaignSlug).toBe(campaign.slug)
    expect(campaignContext.campaignId).toBe(campaign._id)
    expect(campaignContext.isDm).toBe(true)
  })
})
