import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteEditor } from '../note-editor'
import type { NoteWithContent } from 'shared/notes/types'
import type { ReactNode } from 'react'
import { EDITOR_MODE } from 'shared/editor/types'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { testId } from '~/test/helpers/test-id'

const noteContentSpy = vi.hoisted(() => vi.fn())
const noteFormattingToolbarSpy = vi.hoisted(() => vi.fn())
const mockUseEditorMode = vi.hoisted(() => vi.fn())
const setSidebarItemsMemberPermissionMock = vi.hoisted(() => vi.fn())
const campaignMembersQuery = vi.hoisted(() => ({
  data: [
    {
      _id: 'player-1',
      userProfile: {
        email: 'player@example.com',
        imageUrl: null,
        name: 'Player One',
        username: 'player-one',
      },
    },
    {
      _id: 'player-2',
      userProfile: {
        email: 'second@example.com',
        imageUrl: null,
        name: 'Second Player',
        username: 'second-player',
      },
    },
  ],
}))

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

vi.mock('~/features/players/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => campaignMembersQuery,
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: () => ({
    isPending: false,
    mutateAsync: setSidebarItemsMemberPermissionMock,
  }),
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    sidebarShares: {
      mutations: {
        setSidebarItemsMemberPermission: 'setSidebarItemsMemberPermission',
      },
    },
  },
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
    setSidebarItemsMemberPermissionMock.mockReset()
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

  it('shows block-share access warning with a grant note access action', async () => {
    const user = userEvent.setup()
    const note = createNote({
      blockShareAccessWarnings: [
        {
          campaignMemberId: testId<'campaignMembers'>('player-1'),
          blockCount: 2,
        },
      ],
    })

    render(<NoteEditor item={note} />)

    const warning = screen.getByTestId('block-share-access-warning')
    expect(warning).toHaveAccessibleName(
      "There are 2 blocks explicitly shared with Player One, but this note isn't shared with them.",
    )

    await user.click(warning)

    expect(screen.getByRole('dialog')).toHaveTextContent(
      "There are 2 blocks explicitly shared with Player One, but this note isn't shared with them.",
    )
    expect(screen.getByRole('dialog')).toHaveTextContent('Share this note with this player?')

    await user.click(screen.getByRole('button', { name: 'Share note' }))

    expect(setSidebarItemsMemberPermissionMock).toHaveBeenCalledWith({
      sidebarItemIds: [note._id],
      campaignMemberId: testId<'campaignMembers'>('player-1'),
      permissionLevel: PERMISSION_LEVEL.VIEW,
    })
  })

  it('uses aggregate warning language and grants every warning player', async () => {
    const user = userEvent.setup()
    const note = createNote({
      blockShareAccessWarnings: [
        {
          campaignMemberId: testId<'campaignMembers'>('player-1'),
          blockCount: 1,
        },
        {
          campaignMemberId: testId<'campaignMembers'>('player-2'),
          blockCount: 3,
        },
      ],
    })

    render(<NoteEditor item={note} />)

    const warning = screen.getByTestId('block-share-access-warning')
    expect(warning).toHaveAccessibleName(
      'There are blocks that are shared with Player One and Second Player.',
    )

    await user.click(warning)
    await user.click(screen.getByRole('button', { name: 'Share note' }))

    expect(setSidebarItemsMemberPermissionMock).toHaveBeenCalledTimes(2)
    expect(setSidebarItemsMemberPermissionMock).toHaveBeenCalledWith({
      sidebarItemIds: [note._id],
      campaignMemberId: testId<'campaignMembers'>('player-1'),
      permissionLevel: PERMISSION_LEVEL.VIEW,
    })
    expect(setSidebarItemsMemberPermissionMock).toHaveBeenCalledWith({
      sidebarItemIds: [note._id],
      campaignMemberId: testId<'campaignMembers'>('player-2'),
      permissionLevel: PERMISSION_LEVEL.VIEW,
    })
  })

  it('absolutely positions the warning control under the toolbar area', () => {
    render(
      <NoteEditor
        item={createNote({
          blockShareAccessWarnings: [
            {
              campaignMemberId: testId<'campaignMembers'>('player-1'),
              blockCount: 2,
            },
          ],
        })}
      />,
    )

    expect(screen.getByTestId('block-share-access-warning-container')).toHaveClass(
      'absolute',
      'top-12',
      'left-2',
    )
  })

  it('keeps untrusted right-click context menu events ignored', () => {
    render(<NoteEditor item={createNote()} />)
    const wrapper = screen.getByTestId('note-editor-wrapper')

    fireEvent.contextMenu(wrapper, { clientX: 20, clientY: 30 })

    expect(mockOpenBlockNoteContextMenu).not.toHaveBeenCalled()
  })
})

function createNote(overrides: Partial<NoteWithContent> = {}): NoteWithContent {
  return {
    _creationTime: 1,
    _id: testId<'sidebarItems'>('note-id'),
    allPermissionLevel: null,
    ancestors: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
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
    ...overrides,
  } as unknown as NoteWithContent
}
