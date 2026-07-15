import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ReactNode } from 'react'
import { ColorPickerPopover } from '../color-picker-popover'

let activeColorChange: ((color: string) => void) | undefined

vi.mock('@wizard-archive/ui/shadcn/components/color-picker', () => ({
  ColorPicker: ({
    children,
    onChange,
  }: {
    children: ReactNode
    onChange?: (color: string) => void
  }) => {
    activeColorChange = onChange
    return <div>{children}</div>
  },
  ColorPickerHue: () => (
    <button
      type="button"
      data-testid="color-picker-hue"
      onClick={() => activeColorChange?.('#0000ff')}
    />
  ),
  ColorPickerSelection: ({ className }: { className?: string }) => (
    <button
      type="button"
      data-testid="color-picker-selection"
      className={className}
      onClick={() => activeColorChange?.('#00ff00')}
    />
  ),
}))

describe('ColorPickerPopover', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--t-red')
    activeColorChange = undefined
  })

  it('shows a checkerboard-backed semi-transparent trigger preview for partially transparent colors', () => {
    document.documentElement.style.setProperty('--t-red', '#ff0000')
    render(<ColorPickerPopover value={{ color: 'var(--t-red)', opacity: 50 }} onChange={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: 'Open color picker' })
    const triggerBackground = trigger.firstElementChild
    const preview = within(trigger).getByTestId('color-preview')

    expect(triggerBackground?.getAttribute('style')).toContain('linear-gradient')
    expect(triggerBackground?.getAttribute('style')).toContain('color-mix')
    expect(preview.getAttribute('style')).toContain('background-color: rgb(255, 0, 0)')
    expect(preview.getAttribute('style')).not.toContain('background-image')
    expect(preview).toHaveStyle({ opacity: '0.5' })
  })

  it('renders the opacity track with a checkerboard under the gradient', () => {
    document.documentElement.style.setProperty('--t-red', '#ff0000')
    render(<ColorPickerPopover value={{ color: 'var(--t-red)', opacity: 50 }} onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open color picker' }))

    const opacityTrack = screen.getByTestId('opacity-track')
    const opacityTrackBackground = opacityTrack.firstElementChild

    const style = opacityTrackBackground?.getAttribute('style') ?? ''
    expect(style).toContain('linear-gradient(90deg, rgba(255, 0, 0, 0) 0%')
    expect(style).toContain('rgba(255, 0, 0, 1) 100%)')
  })

  it('reports color and opacity changes from picker controls', () => {
    const onChange = vi.fn()
    render(<ColorPickerPopover value={{ color: '#ff0000', opacity: 50 }} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open color picker' }))
    fireEvent.click(screen.getByTestId('color-picker-selection'))
    fireEvent.click(screen.getByTestId('color-picker-hue'))
    fireEvent.change(screen.getByRole('slider'), { target: { value: '51' } })

    expect(onChange).toHaveBeenCalledWith({ color: '#00ff00', opacity: 50 })
    expect(onChange).toHaveBeenCalledWith({ color: '#0000ff', opacity: 50 })
    expect(onChange).toHaveBeenCalledWith({ color: '#ff0000', opacity: 51 })
  })

  it('renders disabled picker controls as a native disabled trigger', () => {
    render(
      <ColorPickerPopover
        value={{ color: 'var(--t-red)', opacity: 50 }}
        onChange={vi.fn()}
        disabled
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Open color picker' })
    expect((trigger as HTMLButtonElement).disabled).toBe(true)
  })

  it('closes and stays closed when disabled while open', () => {
    const { rerender } = render(
      <ColorPickerPopover value={{ color: 'var(--t-red)', opacity: 50 }} onChange={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open color picker' }))
    expect(screen.getByTestId('color-picker-selection')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open color picker' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    rerender(
      <ColorPickerPopover
        value={{ color: 'var(--t-red)', opacity: 50 }}
        onChange={vi.fn()}
        disabled
      />,
    )
    expect(screen.getByRole('button', { name: 'Open color picker' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    rerender(
      <ColorPickerPopover value={{ color: 'var(--t-red)', opacity: 50 }} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Open color picker' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})
