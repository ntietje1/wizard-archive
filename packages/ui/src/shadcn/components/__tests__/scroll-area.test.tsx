import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { ScrollArea } from '../scroll-area'

afterEach(() => vi.restoreAllMocks())

describe('ScrollArea', () => {
  it('uses one overflow shorthand while changing scroll orientation', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <ScrollArea scrollOrientation="none">
        <div>Content</div>
      </ScrollArea>,
    )
    const viewport = screen.getByText('Content').closest('[data-slot="scroll-area-viewport"]')

    expect(viewport).toHaveStyle({ overflow: 'hidden' })

    rerender(
      <ScrollArea scrollOrientation="vertical">
        <div>Content</div>
      </ScrollArea>,
    )

    expect(viewport).toHaveStyle({ overflow: 'hidden scroll' })
    expect(
      consoleError.mock.calls.some(([message]) =>
        String(message).includes('Removing a style property during rerender'),
      ),
    ).toBe(false)
  })
})
