import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import { assertResourceItemColor } from '../../../items'
import { DEFAULT_SIDEBAR_ITEM_COLOR } from '../../../items/appearance'
import { ColorPicker } from '../color-picker'

describe('ColorPicker', () => {
  it('clears the color override when the default swatch is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<ColorPicker value={assertResourceItemColor('#ef4444')} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Select color' }))
    await user.click(screen.getByRole('button', { name: 'Select default color' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('selects a named color swatch', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<ColorPicker value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Select color' }))
    await user.click(screen.getByRole('button', { name: 'Select blue color' }))

    expect(onChange).toHaveBeenCalledWith(assertResourceItemColor('#3b82f6'))
  })

  it('marks the raw selected color option instead of the resolved display color', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ColorPicker
        value={assertResourceItemColor(DEFAULT_SIDEBAR_ITEM_COLOR)}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Select color' }))

    expect(screen.getByRole('button', { name: 'Select default color' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(
      screen
        .getAllByRole('button')
        .filter((button) => button.getAttribute('aria-pressed') === 'true'),
    ).toHaveLength(0)
  })
})
