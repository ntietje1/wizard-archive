import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { assertCampaignSlug } from 'shared/campaigns/validation'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { FOLDER_ACCESS_INHERITANCE } from '@wizard-archive/editor/resources/access-policy'
import { CampaignGeneralTab } from '~/features/settings/components/tabs/campaign-general/campaign-general-tab'
import { useOptionalCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { createCampaign } from '~/test/factories/campaign-factory'
import { mockAppMutation, mockAuthQuery, mockAuthQueryError } from '~/test/mocks/convex-mocks'
import { TestWrapper } from '~/test/test-wrapper'

const mutate = vi.fn()
const mutateAsync = vi.fn()
const navigate = vi.fn()
type AppMutationMockResult = ReturnType<typeof useAppMutation>

function routeIdentity(campaign: ReturnType<typeof createCampaign>) {
  return {
    dmUsername: campaign.dmUserProfile.username,
    campaignSlug: campaign.slug,
  }
}

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useOptionalCampaign: vi.fn(),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

describe('CampaignGeneralTab', () => {
  beforeEach(() => {
    vi.mocked(useOptionalCampaign).mockReset()
    vi.mocked(useAppMutation).mockReset()
    vi.mocked(toast.error).mockReset()
    mutate.mockReset()
    mutateAsync.mockReset()
    navigate.mockReset()
    navigate.mockResolvedValue(undefined)
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
    const campaign = createCampaign()
    vi.mocked(useOptionalCampaign).mockReturnValue({
      ...routeIdentity(campaign),
      campaign: mockAuthQuery<ReturnType<typeof createCampaign>>(undefined),
      isDm: undefined,
      isCampaignLoaded: false,
      campaignId: campaign.id,
    })

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    expect(screen.getByRole('status', { name: 'Loading campaign settings' })).toBeInTheDocument()
  })

  it('shows the campaign settings load failure', () => {
    const campaign = createCampaign()
    vi.mocked(useOptionalCampaign).mockReturnValue({
      ...routeIdentity(campaign),
      campaign: mockAuthQueryError<ReturnType<typeof createCampaign>>(new Error('campaign failed')),
      isDm: undefined,
      isCampaignLoaded: false,
      campaignId: campaign.id,
    })

    render(
      <TestWrapper>
        <CampaignGeneralTab />
      </TestWrapper>,
    )

    expect(screen.getByText('Failed to load campaign settings.')).toBeInTheDocument()
  })

  it('shows the campaign settings load failure after campaign lookup settles without data', () => {
    const campaign = createCampaign()
    vi.mocked(useOptionalCampaign).mockReturnValue({
      ...routeIdentity(campaign),
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
      campaignId: campaign.id,
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
      resourceAccessDefaults: { folderInheritance: FOLDER_ACCESS_INHERITANCE.enabled },
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      ...routeIdentity(campaign),
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

  it('updates campaign details and replaces a changed slug route', async () => {
    const user = userEvent.setup()
    const campaign = createCampaign({
      name: 'Old Campaign',
      description: 'Old description',
      slug: assertCampaignSlug('old-campaign'),
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      ...routeIdentity(campaign),
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

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'New Campaign')
    await user.clear(screen.getByLabelText('Description'))
    await user.type(screen.getByLabelText('Description'), 'New description')
    await user.clear(screen.getByLabelText('Campaign link'))
    await user.type(screen.getByLabelText('Campaign link'), 'new-campaign')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        campaignId: campaign.id,
        name: 'New Campaign',
        description: 'New description',
        slug: 'new-campaign',
      })
    })
    expect(navigate).toHaveBeenCalledWith({
      to: '/campaigns/$dmUsername/$campaignSlug/editor',
      params: {
        dmUsername: campaign.dmUserProfile.username,
        campaignSlug: 'new-campaign',
      },
      search: true,
      replace: true,
    })
    expect(toast.success).toHaveBeenCalledWith('Campaign settings updated')
  })

  it('makes campaign details read-only for non-DMs', () => {
    const campaign = createCampaign({ myMembership: { role: CAMPAIGN_MEMBER_ROLE.Player } })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      ...routeIdentity(campaign),
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

    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.getByLabelText('Description')).toBeDisabled()
    expect(screen.getByLabelText('Campaign link')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('updates the campaign default when the switch changes', () => {
    const campaign = createCampaign({
      resourceAccessDefaults: { folderInheritance: FOLDER_ACCESS_INHERITANCE.disabled },
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      ...routeIdentity(campaign),
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
      resourceAccessDefaults: { folderInheritance: FOLDER_ACCESS_INHERITANCE.enabled },
    })
  })

  it('shows failed campaign default update feedback', () => {
    const campaign = createCampaign({
      resourceAccessDefaults: { folderInheritance: FOLDER_ACCESS_INHERITANCE.disabled },
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      ...routeIdentity(campaign),
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
        resourceAccessDefaults: { folderInheritance: FOLDER_ACCESS_INHERITANCE.enabled },
      },
      undefined,
      undefined as never,
    )

    expect(toast.error).toHaveBeenCalledWith('Failed to update campaign settings')
  })

  it('disables the folder-sharing switch for non-DMs', () => {
    const campaign = createCampaign({
      resourceAccessDefaults: { folderInheritance: FOLDER_ACCESS_INHERITANCE.disabled },
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.Player },
    })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      ...routeIdentity(campaign),
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
      resourceAccessDefaults: { folderInheritance: FOLDER_ACCESS_INHERITANCE.disabled },
      myMembership: { role: CAMPAIGN_MEMBER_ROLE.DM },
    })
    vi.mocked(useOptionalCampaign).mockReturnValue({
      ...routeIdentity(campaign),
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
          resourceAccessDefaults: { folderInheritance: FOLDER_ACCESS_INHERITANCE.enabled },
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
