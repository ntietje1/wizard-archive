import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ColorPickerPopover } from '../color-picker-popover'

vi.mock('~/features/shadcn/components/color-picker', () => ({
  ColorPicker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ColorPickerHue: () => <div data-testid="color-picker-hue" />,
  ColorPickerSelection: ({ className }: { className?: string }) => (
    <div data-testid="color-picker-selection" className={className} />
  ),
}))

describe('ColorPickerPopover', () => {
  it('shows a striped semi-transparent trigger preview for partially transparent colors', () => {
    render(<ColorPickerPopover value={{ color: 'var(--t-red)', opacity: 50 }} onChange={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: 'Open color picker' })
    const preview = within(trigger).getByTestId('color-preview')

    expect(preview.getAttribute('style')).toContain('background-color: var(--t-red)')
    expect(preview.getAttribute('style')).toContain('opacity: 0.5')
    expect(preview.getAttribute('style')).toContain(
      'background-image: repeating-linear-gradient(135deg, var(--muted-foreground) 0 2px, transparent 2px 6px)',
    )
  })

  it('renders the opacity track with a checkerboard under the gradient', () => {
    render(<ColorPickerPopover value={{ color: 'var(--t-red)', opacity: 50 }} onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open color picker' }))

    const opacityTrack = screen.getByTestId('opacity-track')
    expect(opacityTrack).toBeTruthy()

    const style = opacityTrack.getAttribute('style') ?? ''
    expect(style).toContain('linear-gradient')
    expect(style).toContain('background-position: 0px 0px, 0px 0px, 4px 4px')
    expect(style).toContain('background-size: 100% 100%, 8px 8px, 8px 8px')
  })
})
