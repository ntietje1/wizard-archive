import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { MapDropFeedbackOverlay } from '../map-drop-feedback-overlay'

describe('MapDropFeedbackOverlay', () => {
  it('leaves the full drop feedback surface transparent to pointer release events', () => {
    render(<MapDropFeedbackOverlay outcome={{ type: 'operation', action: 'pin', label: 'Pin' }} />)

    const feedback = screen.getByRole('status')

    expect(feedback).toHaveTextContent('Release to place pin here')
    expect(feedback).toHaveClass('pointer-events-none')
  })
})
