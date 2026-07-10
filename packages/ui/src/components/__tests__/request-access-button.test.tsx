import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RequestAccessButton } from '@wizard-archive/ui/components/request-access-button'

const toastInfo = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    info: toastInfo,
  },
}))

describe('RequestAccessButton', () => {
  it('shows the request-access placeholder toast', async () => {
    render(<RequestAccessButton />)

    await userEvent.click(screen.getByRole('button', { name: 'Request Access' }))

    expect(toastInfo).toHaveBeenCalledWith('coming soon')
  })
})
