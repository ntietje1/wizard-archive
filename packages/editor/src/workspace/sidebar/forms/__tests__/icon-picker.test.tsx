import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'

import { IconPicker } from '../icon-picker'

describe('IconPicker', () => {
  it('keeps the default trigger name when no external label is provided', () => {
    render(<IconPicker value={undefined} defaultIcon="FileText" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Select icon' })).toBeInTheDocument()
  })

  it('uses an external label for the trigger when provided', () => {
    render(
      <>
        <span id="icon-label">Icon</span>
        <IconPicker
          value={undefined}
          defaultIcon="FileText"
          onChange={vi.fn()}
          triggerLabelledBy="icon-label"
        />
      </>,
    )

    expect(screen.getByRole('button', { name: 'Icon' })).toBeInTheDocument()
  })

  it('labels icon choices by icon name', async () => {
    const user = userEvent.setup()

    render(<IconPicker value={undefined} defaultIcon="FileText" onChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Select icon' }))

    expect(screen.getByRole('button', { name: 'Select FileText icon' })).toBeInTheDocument()
  })

  it('clears the override when selecting the default icon', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<IconPicker value={undefined} defaultIcon="FileText" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Select icon' }))
    await user.click(screen.getByRole('button', { name: 'Select FileText icon' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('selects a non-default icon override', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<IconPicker value={undefined} defaultIcon="FileText" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Select icon' }))
    await user.click(screen.getByRole('button', { name: 'Select Star icon' }))

    expect(onChange).toHaveBeenCalledWith('Star')
  })
})
