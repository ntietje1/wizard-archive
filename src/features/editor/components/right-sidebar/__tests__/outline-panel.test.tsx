import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { Heading } from 'shared/editor-blocks/types'
import { LiveOutlinePanel } from '../live-outline-panel'
import { OutlinePanel } from '../outline-panel'

const { editorMock, useCampaignQueryMock } = vi.hoisted(() => ({
  editorMock: {
    _tiptapEditor: { view: {} },
    focus: vi.fn(),
    setTextCursorPosition: vi.fn(),
  },
  useCampaignQueryMock: vi.fn(),
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    blocks: {
      queries: {
        getHeadingsByNote: 'getHeadingsByNote',
      },
    },
  },
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

vi.mock('~/features/editor/stores/note-editor-store', () => ({
  useNoteEditorStore: (selector: (state: { editor: typeof editorMock }) => unknown) =>
    selector({ editor: editorMock }),
}))

function heading(id: string, text: string, level: Heading['level']): Heading {
  return {
    blockNoteId: id,
    level,
    normalizedText: text.toLowerCase(),
    text,
  }
}

function sidebarItemId(id: string): Id<'sidebarItems'> {
  return id as Id<'sidebarItems'>
}

describe('OutlinePanel', () => {
  beforeEach(() => {
    editorMock.focus.mockReset()
    editorMock.setTextCursorPosition.mockReset()
    useCampaignQueryMock.mockReset()
  })

  it('renders loading, error, and empty states from source state', () => {
    const onNavigate = vi.fn()
    const { rerender } = render(
      <OutlinePanel onNavigate={onNavigate} state={{ status: 'pending' }} />,
    )

    expect(screen.getByText('Loading outline...')).toBeInTheDocument()

    rerender(<OutlinePanel onNavigate={onNavigate} state={{ status: 'error' }} />)
    expect(screen.getByText('Failed to load outline')).toBeInTheDocument()

    rerender(<OutlinePanel onNavigate={onNavigate} state={{ status: 'success', headings: [] }} />)
    expect(screen.getByText('No headings')).toBeInTheDocument()
    expect(screen.getByText('Add headings to your note to see an outline')).toBeInTheDocument()
  })

  it('renders nested headings and invokes source navigation', () => {
    const onNavigate = vi.fn()
    render(
      <OutlinePanel
        onNavigate={onNavigate}
        state={{
          status: 'success',
          headings: [heading('intro', 'Intro', 1), heading('details', 'Details', 2)],
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Details' }))

    expect(screen.getByRole('button', { name: 'Collapse Intro' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(onNavigate).toHaveBeenCalledWith('details')
  })
})

describe('LiveOutlinePanel', () => {
  beforeEach(() => {
    editorMock.focus.mockReset()
    editorMock.setTextCursorPosition.mockReset()
    useCampaignQueryMock.mockReset()
  })

  it('loads headings from the live source and scrolls through the active editor', () => {
    const scrollIntoView = vi.fn()
    const block = document.createElement('div')
    block.dataset.id = 'intro'
    block.scrollIntoView = scrollIntoView
    document.body.append(block)

    useCampaignQueryMock.mockReturnValue({
      data: [heading('intro', 'Intro', 1)],
      isError: false,
      isPending: false,
    })

    try {
      render(<LiveOutlinePanel itemId={sidebarItemId('note-1')} />)

      fireEvent.click(screen.getByRole('button', { name: 'Intro' }))

      expect(useCampaignQueryMock).toHaveBeenCalledWith('getHeadingsByNote', { noteId: 'note-1' })
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
      expect(editorMock.focus).toHaveBeenCalled()
      expect(editorMock.setTextCursorPosition).toHaveBeenCalledWith('intro', 'end')
    } finally {
      block.remove()
    }
  })
})
