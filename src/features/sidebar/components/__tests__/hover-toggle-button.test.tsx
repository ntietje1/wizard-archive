import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HoverToggleButton } from '../hover-toggle-button'

describe('HoverToggleButton', () => {
  it('swaps hover content without opacity transitions', () => {
    render(
      <HoverToggleButton
        nonHoverComponent={<span>Icon</span>}
        hoverComponent={<span>Chevron</span>}
      />,
    )

    expect(screen.getByTestId('hover-toggle-default')).toHaveClass('group-hover:opacity-0')
    expect(screen.getByTestId('hover-toggle-default')).not.toHaveClass(
      'group-hover:transition-opacity',
    )
    expect(screen.getByTestId('hover-toggle-hover')).toHaveClass('group-hover:opacity-100')
    expect(screen.getByTestId('hover-toggle-hover')).not.toHaveClass(
      'group-hover:transition-opacity',
    )
  })

  it('renders when either side is omitted', () => {
    render(
      <>
        <HoverToggleButton nonHoverComponent={<span>Icon</span>} />
        <HoverToggleButton hoverComponent={<span>Chevron</span>} />
      </>,
    )

    expect(screen.getByText('Icon')).toBeInTheDocument()
    expect(screen.getByText('Chevron')).toBeInTheDocument()
  })
})
