import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteEditor } from '../note-editor'
import type { NoteWithContent } from 'convex/notes/types'
import type { ReactNode } from 'react'
import { EDITOR_MODE } from 'convex/editors/types'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { testId } from '~/test/helpers/test-id'

vi.mock('@tanstack/react-router', () => ({
  ClientOnly: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../../../note-content', () => ({
  NoteContent: ({ className, children }: { className?: string; children?: ReactNode }) => (
    <div className={className} data-testid="note-content">
      {children}
    </div>
  ),
}))

vi.mock('../../../extensions/blocknote-context-menu/blocknote-context-menu-handler', () => ({
  BlockNoteContextMenuHandler: () => null,
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
  useEditorMode: () => ({ canEdit: true, editorMode: EDITOR_MODE.EDITOR }),
}))

vi.mock('~/features/editor/hooks/useFilteredNoteContent', () => ({
  useFilteredNoteContent: (note: NoteWithContent) => ({
    content: note.content,
    isViewOnly: false,
  }),
}))

vi.mock('~/features/editor/hooks/useNoteEditorState', () => ({
  useNoteEditorState: () => ({
    onEditorChange: vi.fn(),
    wrapperRef: { current: null },
  }),
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
  })

  it('uses the CSS-first editor surface class instead of pointer focus handlers', () => {
    render(<NoteEditor item={createNote()} />)

    expect(screen.getByTestId('note-content')).toHaveClass('note-editor-surface')

    const wrapper = screen.getByTestId('note-editor-wrapper')
    fireEvent.pointerDown(wrapper, { button: 0, clientX: 20, clientY: 80 })
    fireEvent.pointerUp(wrapper, { button: 0, clientX: 40, clientY: 80 })

    expect(screen.getByTestId('note-content')).toBeInTheDocument()
    expect(mockOpenBlockNoteContextMenu).not.toHaveBeenCalled()
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
    location: 'sidebar',
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
