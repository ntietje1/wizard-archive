import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DemoRouteContent } from '../demo-route-content'

vi.mock('~/features/landing/components/nav-bar', () => ({
  NavBar: () => <nav data-testid="demo-nav" />,
}))

vi.mock('~/features/landing/components/demo-workspace', () => ({
  DemoWorkspace: () => <section aria-label="Demo workspace" />,
}))

describe('DemoRouteContent', () => {
  it('server-renders the public demo chrome and workspace frame', () => {
    render(<DemoRouteContent />)

    expect(screen.getByTestId('demo-nav')).toBeInTheDocument()
    expect(screen.getByLabelText('Demo project')).toBeInTheDocument()
    expect(document.querySelector('.demo-elevated-frame')).toBeInTheDocument()
    expect(screen.queryByLabelText('Demo project preview placeholder')).not.toBeInTheDocument()
  })
})
