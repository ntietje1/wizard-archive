import { testResourceId } from '../../../../../../shared/test/resource-id'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { NoteBlock, Heading } from '../../../notes/document/model'
import type { NoteItemWithContent } from '../../../notes/item-contract'
import { RIGHT_SIDEBAR_CONTENT } from '../content'
import { createRuntimeRightSidebarSource } from '../runtime-source'
import { useActiveNoteHeadingNavigation } from '../../../notes/outline/note-outline'
import { createNote } from '../../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import { testNoteBlockId } from '../../../test/blocknote-id'
import { OutlinePanel } from '../components/outline'
import { RightSidebarPanel } from '../panels'

const { editorMock } = vi.hoisted(() => ({
  editorMock: {
    _tiptapEditor: { view: {} as { dom?: HTMLElement } },
    focus: vi.fn(),
    setTextCursorPosition: vi.fn(),
  },
}))

vi.mock('../../../notes/editor-store', () => ({
  useNoteEditorStore: (selector: (state: { editor: typeof editorMock }) => unknown) =>
    selector({ editor: editorMock }),
  useScopedNoteEditorStore: (selector: (state: { editor: typeof editorMock }) => unknown) =>
    selector({ editor: editorMock }),
}))

function heading(id: string, text: string, level: Heading['level']): Heading {
  return {
    noteBlockId: testNoteBlockId(id),
    level,
    normalizedText: text.toLowerCase(),
    text,
  }
}

describe('OutlinePanel', () => {
  beforeEach(() => {
    editorMock.focus.mockReset()
    editorMock.setTextCursorPosition.mockReset()
  })

  it('renders loading, error, and empty states from source state', () => {
    const onNavigate = vi.fn()
    const { rerender } = render(
      <OutlinePanel onNavigate={onNavigate} state={{ status: 'pending' }} />,
    )

    expect(screen.getByText('Loading outline...')).toBeInTheDocument()

    rerender(<OutlinePanel onNavigate={onNavigate} state={{ status: 'error' }} />)
    expect(screen.getByText('Failed to load outline')).toBeInTheDocument()

    rerender(
      <OutlinePanel
        onNavigate={onNavigate}
        state={{
          status: 'unavailable',
          availabilityState: {
            status: 'trashed',
            label: 'Archive Note',
            message: 'This item is in the trash.',
          },
        }}
      />,
    )
    expect(screen.getByText('This item is in the trash.')).toBeInTheDocument()
    expect(screen.queryByText('Failed to load outline')).not.toBeInTheDocument()

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

    expect(screen.getByRole('button', { name: 'Collapse Intro' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Intro' }))

    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand Intro' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand Intro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))

    expect(screen.getByRole('button', { name: 'Collapse Intro' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(onNavigate).toHaveBeenCalledWith(testNoteBlockId('details'))
  })

  it('expands and collapses nested headings', () => {
    render(
      <OutlinePanel
        onNavigate={vi.fn()}
        state={{
          status: 'success',
          headings: [heading('intro', 'Intro', 1), heading('details', 'Details', 2)],
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Intro' }))

    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand Intro' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand Intro' }))

    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument()
  })
})

describe('WorkspaceRuntimeOutlinePanel', () => {
  beforeEach(() => {
    editorMock.focus.mockReset()
    editorMock.setTextCursorPosition.mockReset()
  })

  it('loads headings from runtime content and delegates heading navigation', () => {
    const navigateToHeading = vi.fn()
    const note = createOutlineNote()
    const runtime = createTestWorkspaceRuntime({
      contentItem: note,
    })
    const source = createRuntimeRightSidebarSource(runtime, { navigateToHeading })

    render(
      <RightSidebarPanel
        contentId={RIGHT_SIDEBAR_CONTENT.outline}
        itemId={note.id}
        source={source}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Intro' }))

    expect(navigateToHeading).toHaveBeenCalledWith(testNoteBlockId('intro'))
  })

  it('scrolls headings through the active note editor', () => {
    const note = createOutlineNote()
    const outsideScrollIntoView = vi.fn()
    const activeScrollIntoView = vi.fn()
    const outsideBlock = document.createElement('div')
    outsideBlock.dataset.id = testNoteBlockId('intro')
    outsideBlock.scrollIntoView = outsideScrollIntoView
    const editorRoot = document.createElement('div')
    const activeBlock = document.createElement('div')
    activeBlock.dataset.id = testNoteBlockId('intro')
    activeBlock.scrollIntoView = activeScrollIntoView
    editorRoot.append(activeBlock)
    editorMock._tiptapEditor.view.dom = editorRoot

    try {
      document.body.append(outsideBlock, editorRoot)
      render(<RuntimeOutlinePanel note={note} />)

      fireEvent.click(screen.getByRole('button', { name: 'Intro' }))

      expect(activeScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      })
      expect(outsideScrollIntoView).not.toHaveBeenCalled()
      expect(editorMock.focus).toHaveBeenCalled()
      expect(editorMock.setTextCursorPosition).toHaveBeenCalledWith(testNoteBlockId('intro'), 'end')
    } finally {
      outsideBlock.remove()
      editorRoot.remove()
      delete (editorMock._tiptapEditor.view as { dom?: HTMLElement }).dom
    }
  })
})

function createOutlineNote(): NoteItemWithContent {
  const content: Array<NoteBlock> = [
    {
      id: testNoteBlockId('intro'),
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'Intro', styles: {} }],
      children: [],
    },
  ]

  return {
    ...createNote({ id: testResourceId('note-1') }),
    ancestors: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    content,
  }
}

function RuntimeOutlinePanel({ note }: { note: NoteItemWithContent }) {
  const navigateToHeading = useActiveNoteHeadingNavigation()
  const runtime = createTestWorkspaceRuntime({
    contentItem: note,
  })
  const source = createRuntimeRightSidebarSource(runtime, { navigateToHeading })

  return (
    <RightSidebarPanel contentId={RIGHT_SIDEBAR_CONTENT.outline} itemId={note.id} source={source} />
  )
}
