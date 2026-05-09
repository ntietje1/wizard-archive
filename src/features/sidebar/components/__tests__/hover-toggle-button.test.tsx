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

    expect(screen.getByText('Icon').parentElement).toHaveClass('group-hover:opacity-0')
    expect(screen.getByText('Icon').parentElement).not.toHaveClass('group-hover:transition-opacity')
    expect(screen.getByText('Chevron').parentElement).toHaveClass('group-hover:opacity-100')
    expect(screen.getByText('Chevron').parentElement).not.toHaveClass(
      'group-hover:transition-opacity',
    )
  })
})
