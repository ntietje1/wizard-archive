import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DemoRouteContent } from '../demo-route-content'

vi.mock('~/features/landing/components/nav-bar', () => ({
  NavBar: () => <nav data-testid="demo-nav" />,
}))

vi.mock('~/features/landing/components/demo-workspace', () => ({
  DemoWorkspace: () => <section aria-label="Ephemeral demo workspace" />,
}))

describe('DemoRouteContent', () => {
  it('renders the ephemeral workspace instead of a static fixture board', () => {
    render(<DemoRouteContent />)

    expect(screen.getByTestId('demo-nav')).toBeInTheDocument()
    expect(screen.getByLabelText('Demo project')).toBeInTheDocument()
    expect(screen.getByLabelText('Ephemeral demo workspace')).toBeInTheDocument()
    expect(screen.queryByLabelText('Demo project preview placeholder')).not.toBeInTheDocument()
  })
})
