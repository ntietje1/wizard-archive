import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { PendingRequestsSection } from '~/features/settings/components/tabs/campaign-people/components/pending-requests-section'
import { RejectedRemovedSection } from '~/features/settings/components/tabs/campaign-people/components/rejected-removed-section'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { createCampaign, createCampaignMember } from '~/test/factories/campaign-factory'
import { mockAppMutation } from '~/test/mocks/convex-mocks'

const mutateAsync = vi.fn()
type AppMutationMockResult = ReturnType<typeof useAppMutation>

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

describe('campaign people request sections', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
    mutateAsync.mockResolvedValue(undefined)
    vi.mocked(useAppMutation).mockReset()
    vi.mocked(useAppMutation).mockReturnValue(createMutationResult())
    vi.mocked(toast.success).mockReset()
  })

  it('accepts and rejects pending players through the campaign member status mutation', async () => {
    const user = userEvent.setup()
    const campaign = createCampaign()
    const pendingPlayer = createCampaignMember({
      campaignId: campaign.id,
      status: CAMPAIGN_MEMBER_STATUS.Pending,
    })

    render(<PendingRequestsSection pendingPlayers={[pendingPlayer]} campaignId={campaign.id} />)

    await user.click(screen.getByRole('button', { name: /reject/i }))
    await user.click(screen.getByRole('button', { name: /accept/i }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(2)
    })
    expect(mutateAsync).toHaveBeenNthCalledWith(1, {
      campaignId: campaign.id,
      memberId: pendingPlayer.id,
      status: CAMPAIGN_MEMBER_STATUS.Rejected,
    })
    expect(mutateAsync).toHaveBeenNthCalledWith(2, {
      campaignId: campaign.id,
      memberId: pendingPlayer.id,
      status: CAMPAIGN_MEMBER_STATUS.Accepted,
    })
    expect(toast.success).toHaveBeenCalledWith('Player status updated')
  })

  it('accepts rejected requests and restores removed players', async () => {
    const user = userEvent.setup()
    const campaign = createCampaign()
    const rejectedPlayer = createCampaignMember({
      campaignId: campaign.id,
      status: CAMPAIGN_MEMBER_STATUS.Rejected,
    })
    const removedPlayer = createCampaignMember({
      campaignId: campaign.id,
      status: CAMPAIGN_MEMBER_STATUS.Removed,
    })

    render(
      <RejectedRemovedSection players={[rejectedPlayer, removedPlayer]} campaignId={campaign.id} />,
    )

    await user.click(screen.getByRole('button', { name: /rejected & removed/i }))
    await user.click(screen.getByRole('button', { name: /accept request/i }))
    await user.click(screen.getByRole('button', { name: /restore player/i }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(2)
    })
    expect(mutateAsync).toHaveBeenNthCalledWith(1, {
      campaignId: campaign.id,
      memberId: rejectedPlayer.id,
      status: CAMPAIGN_MEMBER_STATUS.Accepted,
    })
    expect(mutateAsync).toHaveBeenNthCalledWith(2, {
      campaignId: campaign.id,
      memberId: removedPlayer.id,
      status: CAMPAIGN_MEMBER_STATUS.Accepted,
    })
  })
})

function createMutationResult(
  overrides: Partial<AppMutationMockResult> = {},
): AppMutationMockResult {
  return mockAppMutation({
    mutateAsync,
    ...overrides,
  }) as AppMutationMockResult
}
