import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteEditor } from '../note-editor'
import type { NoteWithContent } from 'convex/notes/types'
import type { ReactNode } from 'react'
import { EDITOR_MODE } from 'shared/editor/types'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { testId } from '~/test/helpers/test-id'

const noteContentSpy = vi.hoisted(() => vi.fn())
const noteFormattingToolbarSpy = vi.hoisted(() => vi.fn())
const mockUseEditorMode = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  ClientOnly: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../../../note-content', () => ({
  NoteContent: (props: { className?: string; children?: ReactNode }) => {
    noteContentSpy(props)
    return (
      <div className={props.className} data-testid="note-content">
        {props.children}
      </div>
    )
  },
}))

vi.mock('~/features/editor/components/formatting-toolbar/note-formatting-toolbar', () => ({
  NoteFormattingToolbar: (props: { editor: unknown; visible: boolean }) => {
    noteFormattingToolbarSpy(props)
    return <div data-testid="note-formatting-toolbar" />
  },
}))

vi.mock('~/features/editor/contexts/blocknote-context-menu-context', () => ({
  BlockNoteContextMenuProvider: ({ children }: { children: ReactNode }) => children,
}))

const mockOpenBlockNoteContextMenu = vi.hoisted(() => vi.fn())
vi.mock('~/features/editor/hooks/useBlockNoteContextMenu', () => ({
  openBlockNoteContextMenu: mockOpenBlockNoteContextMenu,
}))

vi.mock('~/features/sidebar/utils/sidebar-item-utils', () => ({
  isNote: () => true,
}))

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: mockUseEditorMode,
}))

vi.mock('~/features/editor/hooks/useNoteEditorState', () => ({
  useNoteEditorState: () => ({
    onEditorChange: vi.fn(),
    wrapperRef: { current: null },
  }),
}))

vi.mock('~/features/editor/stores/note-editor-store', () => ({
  useNoteEditorStore: (selector: (store: { editor: null }) => unknown) =>
    selector({ editor: null }),
}))

vi.mock('~/features/editor/hooks/useScrollPersistence', () => ({
  useScrollPersistence: vi.fn(),
}))

vi.mock('~/features/editor/hooks/useScrollToHeading', () => ({
  useScrollToHeading: () => ({ hasHeadingParam: false }),
}))

vi.mock('~/features/shadcn/components/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => (
    <div data-testid="note-scroll-area">{children}</div>
  ),
}))

describe('NoteEditor', () => {
  beforeEach(() => {
    mockOpenBlockNoteContextMenu.mockReset()
    noteContentSpy.mockReset()
    noteFormattingToolbarSpy.mockReset()
    mockUseEditorMode.mockReturnValue({ canEdit: true, editorMode: EDITOR_MODE.EDITOR })
  })

  it('uses the CSS-first editor surface class instead of pointer focus handlers', async () => {
    const user = userEvent.setup()
    render(<NoteEditor item={createNote()} />)

    expect(screen.getByTestId('note-content')).toHaveClass('note-editor-surface')

    const wrapper = screen.getByTestId('note-editor-wrapper')
    await user.pointer([
      { keys: '[MouseLeft>]', target: wrapper, coords: { clientX: 20, clientY: 80 } },
      { keys: '[/MouseLeft]', target: wrapper, coords: { clientX: 40, clientY: 80 } },
    ])

    expect(mockOpenBlockNoteContextMenu).not.toHaveBeenCalled()
  })

  it('passes the whole note to NoteContent so it owns visibility filtering', () => {
    const note = createNote()

    render(<NoteEditor item={note} />)

    expect(noteContentSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        note,
      }),
    )
    expect(noteContentSpy.mock.calls[0]?.[0]).not.toHaveProperty('content')
  })

  it('places the full formatting toolbar above the note scroll area', () => {
    render(<NoteEditor item={createNote()} />)

    const toolbar = screen.getByTestId('note-formatting-toolbar')
    const scrollArea = screen.getByTestId('note-scroll-area')

    expect(toolbar.compareDocumentPosition(scrollArea)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(noteFormattingToolbarSpy).toHaveBeenCalledWith({
      editor: null,
      visible: true,
    })
  })

  it('hides the formatting toolbar for non-editable notes', () => {
    mockUseEditorMode.mockReturnValue({ canEdit: false, editorMode: EDITOR_MODE.VIEWER })

    render(<NoteEditor item={createNote()} />)

    expect(noteFormattingToolbarSpy).toHaveBeenCalledWith({
      editor: null,
      visible: false,
    })
  })

  it('keeps untrusted right-click context menu events ignored', () => {
    render(<NoteEditor item={createNote()} />)
    const wrapper = screen.getByTestId('note-editor-wrapper')

    fireEvent.contextMenu(wrapper, { clientX: 20, clientY: 30 })

    expect(mockOpenBlockNoteContextMenu).not.toHaveBeenCalled()
  })
})

function createNote(): NoteWithContent {
  return {
    _creationTime: 1,
    _id: testId<'sidebarItems'>('note-id'),
    allPermissionLevel: null,
    ancestors: [],
    blockMeta: {},
    campaignId: testId<'campaigns'>('campaign-id'),
    color: null,
    content: [],
    createdBy: testId<'userProfiles'>('user-id'),
    deletedBy: null,
    deletionTime: null,
    iconName: null,
    isBookmarked: false,
    status: 'active',
    myPermissionLevel: 'full_access',
    name: 'Note',
    parentId: null,
    previewClaimToken: null,
    previewLockedUntil: null,
    previewStorageId: null,
    previewUpdatedAt: null,
    previewUrl: null,
    shares: [],
    slug: 'note',
    type: SIDEBAR_ITEM_TYPES.notes,
    updatedBy: null,
    updatedTime: null,
  } as unknown as NoteWithContent
}
