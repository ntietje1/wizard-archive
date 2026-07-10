import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useContextMenu } from '../use-context-menu'
import type { ContextMenuHostRef } from '../../components/host'

function MoreOptionsHarness({ open }: { open: ContextMenuHostRef['open'] }) {
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  contextMenuRef.current = { open, close: vi.fn() }

  return (
    <button type="button" onClick={handleMoreOptions}>
      More
    </button>
  )
}

describe('useContextMenu', () => {
  it('opens more-options menus at the pointer position when one is available', () => {
    const open = vi.fn()
    render(<MoreOptionsHarness open={open} />)

    fireEvent.click(screen.getByRole('button', { name: 'More' }), {
      clientX: 18,
      clientY: 42,
    })

    expect(open).toHaveBeenCalledWith({ x: 18, y: 42 })
  })

  it('opens keyboard-triggered more-options menus from the trigger element', () => {
    const open = vi.fn()
    render(<MoreOptionsHarness open={open} />)

    const button = screen.getByRole('button', { name: 'More' })
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 32, y: 12, width: 48, height: 20 }),
    )

    fireEvent.click(button, { clientX: 0, clientY: 0 })

    expect(open).toHaveBeenCalledWith({ x: 32, y: 32 })
  })
})
