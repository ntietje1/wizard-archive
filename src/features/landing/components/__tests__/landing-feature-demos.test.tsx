import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CanvasFeatureDemo,
  HeroProductDemo,
  SharingFeatureDemo,
  TemplatesFeatureDemo,
  WorkspaceFeatureDemo,
} from '../landing-feature-demos'

describe('landing feature demos', () => {
  it('lets the workspace preview edit its local note and file name', () => {
    render(<WorkspaceFeatureDemo />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Landing demo note body' }), {
      target: { value: 'Add the tower clue before exporting.' },
    })
    fireEvent.change(screen.getByDisplayValue('session-12-brief.md'), {
      target: { value: 'tower-clues.md' },
    })

    expect(screen.getByDisplayValue('Add the tower clue before exporting.')).toBeInTheDocument()
    expect(screen.getByText('tower-clues.md')).toBeInTheDocument()
  })

  it('updates the hero preview selection locally', () => {
    render(<HeroProductDemo />)

    fireEvent.click(screen.getByRole('button', { name: 'Canal map' }))

    expect(screen.getByRole('button', { name: 'Canal map' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Canal district approach')).toBeInTheDocument()
    expect(screen.getByText('Visible: market and bridge pins')).toBeInTheDocument()
  })

  it('toggles sharing state in the player preview', () => {
    render(<SharingFeatureDemo />)

    fireEvent.click(screen.getByRole('button', { name: 'Hide clue from players' }))
    fireEvent.click(screen.getByRole('button', { name: 'Allow player edits' }))

    expect(screen.getByText('No tower clue shared yet.')).toBeInTheDocument()
    expect(screen.getByText('Access: collaborative editing enabled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disable player edits' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('selects canvas nodes and template tabs without live app wiring', () => {
    render(
      <>
        <CanvasFeatureDemo />
        <TemplatesFeatureDemo />
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Canal Crew/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Location' }))

    expect(screen.getByRole('button', { name: /Canal Crew/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Location' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Location template')).toBeInTheDocument()
  })
})
