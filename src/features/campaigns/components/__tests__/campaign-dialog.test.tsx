import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseMutationResult } from '@tanstack/react-query'
import type { api } from 'convex/_generated/api'
import type { Campaign } from 'convex/campaigns/types'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { CampaignDialog } from '~/features/campaigns/components/campaign-dialog'
import { createCampaign } from '~/test/factories/campaign-factory'
import { createUser } from '~/test/factories/user-factory'
import { mockAppMutation, mockAuthQuery } from '~/test/mocks/convex-mocks'
import { TestWrapper } from '~/test/test-wrapper'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

type CreateCampaignInput = FunctionArgs<typeof api.campaigns.mutations.createCampaign>
type CreateCampaignResult = FunctionReturnType<typeof api.campaigns.mutations.createCampaign>

const mutateAsync = vi.fn()

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: vi.fn(),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: vi.fn(),
}))

beforeEach(() => {
  mutateAsync.mockReset()
  vi.mocked(useAuthQuery).mockReset()
  vi.mocked(useAppMutation).mockReset()
})

function renderCampaignDialog(campaigns: Array<Campaign> = []) {
  vi.mocked(useAuthQuery).mockReturnValue(mockAuthQuery(createUser({ username: 'dm-user' })))
  vi.mocked(useAppMutation).mockReturnValue(
    mockAppMutation<CreateCampaignResult, CreateCampaignInput>({
      mutateAsync,
    }) as UseMutationResult<CreateCampaignResult, Error, CreateCampaignInput>,
  )

  return render(
    <TestWrapper>
      <CampaignDialog mode="create" isOpen onClose={vi.fn()} campaigns={campaigns} />
    </TestWrapper>,
  )
}

describe('CampaignDialog', () => {
  it('keeps single dashes typed into a valid campaign slug', async () => {
    const user = userEvent.setup()
    renderCampaignDialog()

    const input = screen.getByLabelText(/custom link/i)
    await user.clear(input)
    await user.type(input, 'my-campaign')

    expect(input).toHaveValue('my-campaign')
    expect(
      screen.queryByText('Campaign link can only contain single hyphens'),
    ).not.toBeInTheDocument()
  })

  it('shows validation error for consecutive hyphens', async () => {
    const user = userEvent.setup()
    renderCampaignDialog()

    const input = screen.getByLabelText(/custom link/i)
    await user.clear(input)
    await user.type(input, 'my--campaign')
    await user.tab()

    expect(screen.getByText('Campaign link can only contain single hyphens')).toBeInTheDocument()
  })

  it('keeps invalid slug characters visible and shows validation feedback', async () => {
    const user = userEvent.setup()
    renderCampaignDialog()

    const input = screen.getByLabelText(/custom link/i)
    await user.clear(input)
    await user.type(input, 'MyCampaign')
    await user.tab()

    expect(input).toHaveValue('MyCampaign')
    expect(screen.getByText('Campaign link cannot contain uppercase letters')).toBeInTheDocument()
  })

  it('does not show slug validation feedback while the user is still typing', async () => {
    const user = userEvent.setup()
    renderCampaignDialog()

    const input = screen.getByLabelText(/custom link/i)
    await user.clear(input)
    await user.type(input, 'My Campaign')

    expect(input).toHaveValue('My Campaign')
    expect(screen.queryByText(/Campaign link cannot contain/)).not.toBeInTheDocument()

    expect(
      await screen.findByText('Campaign link cannot contain uppercase letters'),
    ).toBeInTheDocument()
  })

  it('explains trailing hyphen slug errors after validation runs', async () => {
    const user = userEvent.setup()
    renderCampaignDialog()

    const input = screen.getByLabelText(/custom link/i)
    await user.clear(input)
    await user.type(input, 'my-campaign-')
    await user.tab()

    expect(screen.getByText('Campaign link cannot start or end with a hyphen')).toBeInTheDocument()
  })

  it('explains leading hyphen slug errors after validation runs', async () => {
    const user = userEvent.setup()
    renderCampaignDialog()

    const input = screen.getByLabelText(/custom link/i)
    await user.clear(input)
    await user.type(input, '-my-campaign')
    await user.tab()

    expect(screen.getByText('Campaign link cannot start or end with a hyphen')).toBeInTheDocument()
  })

  it('shows duplicate feedback for duplicate valid campaign slugs', async () => {
    const user = userEvent.setup()
    renderCampaignDialog([createCampaign({ slug: 'taken-slug' })])

    const input = screen.getByLabelText(/custom link/i)
    await user.clear(input)
    await user.type(input, 'taken-slug')

    expect(await screen.findByText('This link is already taken.')).toBeInTheDocument()
  })

  it('submits the exact validated slug shown in the field', async () => {
    const user = userEvent.setup()
    renderCampaignDialog()

    await user.type(screen.getByLabelText(/campaign name/i), 'Dragon Quest')
    const slugInput = screen.getByLabelText(/custom link/i)
    await user.clear(slugInput)
    await user.type(slugInput, 'my-campaign')
    await user.click(screen.getByRole('button', { name: /create campaign/i }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        name: 'Dragon Quest',
        description: '',
        slug: 'my-campaign',
      })
    })
  })
})
