import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseMutationResult } from '@tanstack/react-query'
import type { api } from 'convex/_generated/api'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { CampaignDialog } from '~/features/campaigns/components/campaign-dialog'
import { mockAppMutation } from '~/test/mocks/convex-mocks'
import { TestWrapper } from '~/test/test-wrapper'
import { useAppMutation } from '~/shared/hooks/useAppMutation'

type CreateCampaignInput = FunctionArgs<typeof api.campaigns.mutations.createCampaign>
type CreateCampaignResult = FunctionReturnType<typeof api.campaigns.mutations.createCampaign>

const mutateAsync = vi.fn()

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: vi.fn(),
}))

beforeEach(() => {
  mutateAsync.mockReset()
  vi.mocked(useAppMutation).mockReset()
  vi.mocked(useAppMutation).mockReturnValue(
    mockAppMutation<CreateCampaignResult, CreateCampaignInput>({
      mutateAsync,
    }) as UseMutationResult<CreateCampaignResult, Error, CreateCampaignInput>,
  )
})

describe('CampaignDialog', () => {
  it('creates a campaign from its name and optional description', async () => {
    const user = userEvent.setup()
    render(
      <TestWrapper>
        <CampaignDialog mode="create" isOpen onClose={vi.fn()} />
      </TestWrapper>,
    )

    await user.type(screen.getByLabelText(/campaign name/i), 'Dragon Quest')
    await user.type(screen.getByLabelText(/description/i), '  Into the mountains  ')
    await user.click(screen.getByRole('button', { name: /create campaign/i }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        name: 'Dragon Quest',
        description: 'Into the mountains',
      })
    })
    expect(screen.queryByLabelText(/custom link/i)).not.toBeInTheDocument()
  })
})
