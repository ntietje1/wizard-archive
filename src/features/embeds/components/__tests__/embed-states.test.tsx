import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmbedEmptyState } from '../embed-empty-state'
import { EmbedUnavailable } from '../embed-unavailable'

describe('embed states', () => {
  it('describes all empty embed creation paths', () => {
    render(<EmbedEmptyState onUpload={vi.fn()} onLinkExternal={vi.fn()} />)

    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /link to an external file/i })).toBeInTheDocument()
  })

  it('calls upload and external link actions', async () => {
    const upload = vi.fn()
    const link = vi.fn()
    render(<EmbedEmptyState onUpload={upload} onLinkExternal={link} />)

    await userEvent.click(screen.getByRole('button', { name: /upload/i }))
    await userEvent.click(screen.getByRole('button', { name: /link to an external file/i }))

    expect(upload).toHaveBeenCalled()
    expect(link).toHaveBeenCalled()
  })

  it('does not render editable actions without handlers', () => {
    render(<EmbedEmptyState />)

    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /link to an external file/i }),
    ).not.toBeInTheDocument()
  })

  it('uses the shared successful drop target chrome while an item is dragged over it', () => {
    render(<EmbedEmptyState dropVisualState={{ isDropTarget: true, isFileDropTarget: false }} />)

    expect(screen.getByTestId('embed-empty-state')).toHaveClass(
      'ring-2',
      'ring-inset',
      'ring-drop-target',
      'bg-drop-target-fill',
    )
  })

  it('uses the shared file drop target chrome while a file is dragged over it', () => {
    render(<EmbedEmptyState dropVisualState={{ isDropTarget: true, isFileDropTarget: true }} />)

    expect(screen.getByTestId('embed-empty-state')).toHaveClass(
      'ring-2',
      'ring-inset',
      'ring-drop-target-file',
      'bg-drop-target-fill',
    )
  })

  it('uses passive copy in readonly mode', () => {
    render(<EmbedEmptyState mode="readonly" />)

    expect(screen.getByText('No embed selected')).toBeInTheDocument()
    expect(screen.queryByText(/drag and drop/i)).not.toBeInTheDocument()
  })

  it('renders recursive unavailable state', () => {
    render(<EmbedUnavailable reason="recursive" label="Note A" />)

    expect(screen.getByText(/recursive embed/i)).toBeInTheDocument()
  })
})
