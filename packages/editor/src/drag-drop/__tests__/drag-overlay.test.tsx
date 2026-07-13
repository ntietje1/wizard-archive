import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { DragOverlayPortal } from '../drag-overlay'
import { createNote } from '../../test/sidebar-item-factory'

describe('DragOverlayPortal', () => {
  it('does not render a rejected-items warning for zero rejected items', () => {
    const overlayRef = { current: null } as React.RefObject<HTMLDivElement | null>
    const note = createNote({ name: 'Scene Notes' })

    render(
      <DragOverlayPortal
        overlayRef={overlayRef}
        dragState={{
          draggedItem: note,
          outcome: { type: 'operation', action: 'pin', label: 'Pin item to "World Map"' },
          rejectedItemCount: 0,
        }}
      />,
    )

    expect(screen.getByText('Pin item to "World Map"')).toBeInTheDocument()
    expect(screen.queryByText(/cannot be included/)).not.toBeInTheDocument()
  })

  it('renders the rejected item count for a partial operation', () => {
    const note = createNote({ name: 'Scene Notes' })

    render(
      <DragOverlayPortal
        overlayRef={{ current: null }}
        dragState={{
          draggedItem: note,
          outcome: { type: 'operation', action: 'pin', label: 'Pin selected items' },
          rejectedItemCount: 2,
        }}
      />,
    )

    expect(screen.getByText('2 items cannot be included')).toBeInTheDocument()
  })
})
