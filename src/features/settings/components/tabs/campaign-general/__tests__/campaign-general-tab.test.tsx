import { fireEvent, render, screen } from '@testing-library/react'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { assertUsername } from 'shared/users/validation'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CampaignGeneralTab } from '~/features/settings/components/tabs/campaign-general/campaign-general-tab'
import { useOptionalCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { createCampaign } from '~/test/factories/campaign-factory'
import { mockAppMutation, mockAuthQuery, mockAuthQueryError } from '~/test/mocks/convex-mocks'
import { TestWrapper } from '~/test/test-wrapper'

const mutate = vi.fn()
const mutateAsync = vi.fn()
type AppMutationMockResult = ReturnType<typeof useAppMutation>

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useOptionalCampaign: vi.fn(),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

describe('CampaignGeneralTab', () => {
  beforeEach(() => {
    vi.mocked(useOptionalCampaign).mockReset()
    vi.mocked(useAppMutation).mockReset()
    vi.mocked(toast.error).mockReset()
    mutate.mockReset()
    mutateAsync.mockReset()
    vi.mocked(useAppMutation).mockReturnValue(createMutationResult())
  })

  it('shows campaign settings guidance when no campaign route is active', () => {
    vi.mocked(useOptionalCampaign).mockReturnValue(null)

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument()
    expect(screen.getByText('Open a campaign to manage campaign settings.')).toBeInTheDocument()
  })

  it('announces loading while campaign settings are pending', () => {
    const campaign = createCampaign({ slug: 'pending-campaign' })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      dmUsername: assertUsername('testdm'),
      campaignSlug: campaign.slug,
      campaign: mockAuthQuery<ReturnType<typeof createCampaign>>(undefined),
      isDm: undefined,
      isCampaignLoaded: false,
      campaignId: undefined,
    })

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    expect(screen.getByRole('status', { name: 'Loading campaign settings' })).toBeInTheDocument()
  })

  it('shows the campaign settings load failure', () => {
    const campaign = createCampaign({ slug: 'failed-campaign' })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      dmUsername: assertUsername('testdm'),
      campaignSlug: campaign.slug,
      campaign: mockAuthQueryError<ReturnType<typeof createCampaign>>(new Error('campaign failed')),
      isDm: undefined,
      isCampaignLoaded: false,
      campaignId: undefined,
    })

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    expect(screen.getByText('Failed to load campaign settings.')).toBeInTheDocument()
  })

  it('shows the campaign settings load failure after campaign lookup settles without data', () => {
    const campaign = createCampaign({ slug: 'missing-campaign' })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      dmUsername: assertUsername('testdm'),
      campaignSlug: campaign.slug,
      campaign: mockAuthQuery<ReturnType<typeof createCampaign>>(undefined, {
        fetchStatus: 'idle',
        isFetching: false,
        isLoading: false,
        isPending: false,
        isSuccess: true,
        status: 'success',
      }),
      isDm: undefined,
      isCampaignLoaded: true,
      campaignId: undefined,
    })

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    expect(screen.getByText('Failed to load campaign settings.')).toBeInTheDocument()
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
      campaignId: campaign.id,
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
      campaignId: campaign.id,
    })

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    fireEvent.click(screen.getByRole('switch', { name: /share folder contents automatically/i }))

    expect(mutate).toHaveBeenCalledWith({
      campaignId: campaign.id,
      defaultFolderInheritShares: true,
    })
  })

  it('shows failed campaign default update feedback', () => {
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
      campaignId: campaign.id,
    })

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    const updateOptions = vi.mocked(useAppMutation).mock.calls[0]?.[1]
    updateOptions?.onError?.(
      new Error('update failed'),
      {
        campaignId: campaign.id,
        defaultFolderInheritShares: true,
      },
      undefined,
      undefined as never,
    )

    expect(toast.error).toHaveBeenCalledWith('Failed to update campaign settings')
  })

  it('disables the folder-sharing switch for non-DMs', () => {
    const campaign = createCampaign({
      defaultFolderInheritShares: false,
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.Player },
    })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      dmUsername: assertUsername('testdm'),
      campaignSlug: campaign.slug,
      campaign: mockAuthQuery(campaign),
      isDm: false,
      isCampaignLoaded: true,
      campaignId: campaign.id,
    })

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    expect(
      screen.getByRole('switch', { name: /share folder contents automatically/i }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('disables the folder-sharing switch while a campaign update is pending', () => {
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
      campaignId: campaign.id,
    })
    vi.mocked(useAppMutation).mockReturnValue(
      createMutationResult({
        isPending: true,
        variables: {
          campaignId: campaign.id,
          defaultFolderInheritShares: true,
        },
      }),
    )

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    const switchControl = screen.getByRole('switch', {
      name: /share folder contents automatically/i,
    })
    expect(switchControl).toHaveAttribute('aria-disabled', 'true')
    expect(switchControl).toHaveAttribute('aria-checked', 'true')
  })
})

function createMutationResult(
  overrides: Partial<AppMutationMockResult> = {},
): AppMutationMockResult {
  return mockAppMutation({
    mutate,
    mutateAsync,
    ...overrides,
  }) as AppMutationMockResult
}
