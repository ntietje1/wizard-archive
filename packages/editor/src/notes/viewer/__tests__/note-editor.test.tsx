import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NoteEditor } from '../note-editor'
import type { NoteItemWithContent } from '../../../notes/item-contract'
import type { ReactNode } from 'react'
import { WORKSPACE_MODE } from '../../../../../../shared/workspace/workspace-mode'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import type {
  NoteDocumentContentSource,
  EmbeddedNoteContentSource,
  NoteEmbedTargetContentSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
  NotePermissionContentSource,
  NotePlaybackContentSource,
  NoteScrollRequest,
  NoteSharingContentSource,
  NoteWikiLinkContentSource,
} from '../../runtime'
import type { NoteEditorSetParticipantPermission, NoteEditorSource } from '../note-editor-source'
import type { EditorShareParticipant } from '../../../sharing/contracts'
import type { WikiLinkAutocompleteItemSource } from '../../wiki-link/autocomplete-model'
import { buildWikiLinkAutocompleteModelFromSource } from '../../wiki-link/autocomplete-model'
import type { WikiLinkAutocompleteModelData } from '../../wiki-link/autocomplete-source'
import type { NoteScrollStore } from '../use-scroll-persistence'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from '../../value-runtime-model'

const noteContentSpy = vi.hoisted(() => vi.fn())
const noteFormattingToolbarSpy = vi.hoisted(() => vi.fn())
const setParticipantPermissionMock = vi.hoisted(() => vi.fn())
const useScrollPersistenceMock = vi.hoisted(() => vi.fn())
const participants = [
  createParticipant('player-1', 'Player One', 'player@example.com'),
  createParticipant('player-2', 'Second Player', 'second@example.com'),
]

vi.mock('../../content', () => ({
  NoteContent: (props: { className?: string; children?: ReactNode }) => {
    noteContentSpy(props)
    return (
      <div className={props.className} data-testid="note-content">
        <div className="bn-editor">
          <div data-id="block-1" data-node-type="blockContainer" data-testid="blocknote-block">
            Block text
          </div>
        </div>
        {props.children}
      </div>
    )
  },
}))

vi.mock('../note-formatting-toolbar', () => ({
  NoteFormattingToolbar: (props: { editor: unknown; visible: boolean }) => {
    noteFormattingToolbarSpy(props)
    return <div data-testid="note-formatting-toolbar" />
  },
}))

vi.mock('../../editor-store', () => ({
  useNoteEditorStore: (
    selector: (store: { claimEditor: () => () => void; editor: null }) => unknown,
  ) => selector({ claimEditor: () => () => {}, editor: null }),
  useScopedNoteEditorStore: (
    selector: (store: { claimEditor: () => () => void; editor: null }) => unknown,
  ) => selector({ claimEditor: () => () => {}, editor: null }),
}))

vi.mock('../use-scroll-persistence', () => ({
  useScrollPersistence: useScrollPersistenceMock,
}))

vi.mock('@wizard-archive/ui/shadcn/components/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => (
    <div data-testid="note-scroll-area">{children}</div>
  ),
}))

describe('NoteEditor', () => {
  beforeEach(() => {
    noteContentSpy.mockReset()
    noteFormattingToolbarSpy.mockReset()
    setParticipantPermissionMock.mockReset()
    useScrollPersistenceMock.mockReset()
  })

  it('passes the whole note to NoteContent so it owns visibility filtering', () => {
    const note = createNote()

    renderNoteEditor(note)

    expect(noteContentSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        note,
      }),
    )
  })

  it('places the full formatting toolbar above the note scroll area', () => {
    renderNoteEditor(createNote())

    const toolbar = screen.getByTestId('note-formatting-toolbar')
    const scrollArea = screen.getByTestId('note-scroll-area')

    expect(toolbar.compareDocumentPosition(scrollArea)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(noteFormattingToolbarSpy).toHaveBeenCalledWith({
      editor: null,
      visible: true,
    })
  })

  it('uses note source permissions', () => {
    const note = createNote()

    renderNoteEditor(note)

    expect(noteFormattingToolbarSpy).toHaveBeenCalledWith({
      editor: null,
      visible: true,
    })
    expect(noteContentSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: true,
        note,
      }),
    )
  })

  it('uses source-owned heading request state for scroll persistence', () => {
    const note = createNote()
    const scrollStore = createTestNoteScrollStore()

    renderNoteEditor(note, { noteScrollRequest: { status: 'requested' }, scrollStore })

    expect(useScrollPersistenceMock).toHaveBeenCalledWith(note.id, null, scrollStore, true)
  })

  it('shows block-share access warning with a grant note access action', async () => {
    const user = userEvent.setup()
    const note = createNote({
      blockShareAccessWarnings: [
        {
          campaignMemberId: testId('player-1'),
          blockCount: 2,
        },
      ],
    })

    renderNoteEditor(note)

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

    expect(setParticipantPermissionMock).toHaveBeenCalledWith({
      itemIds: [note.id],
      participantId: testId('player-1'),
      permissionLevel: PERMISSION_LEVEL.VIEW,
    })
  })

  it('uses the note source filesystem operation for source-backed block-share warnings', async () => {
    const user = userEvent.setup()
    const sourcesetParticipantPermissionMock = vi.fn()
    const note = createNote({
      blockShareAccessWarnings: [
        {
          campaignMemberId: testId('player-1'),
          blockCount: 2,
        },
      ],
    })

    renderNoteEditor(note, {
      setParticipantPermission: sourcesetParticipantPermissionMock,
    })

    await user.click(screen.getByTestId('block-share-access-warning'))
    await user.click(screen.getByRole('button', { name: 'Share note' }))

    expect(sourcesetParticipantPermissionMock).toHaveBeenCalledWith({
      itemIds: [note.id],
      participantId: testId('player-1'),
      permissionLevel: PERMISSION_LEVEL.VIEW,
    })
  })

  it('uses aggregate warning language and grants every warning player', async () => {
    const user = userEvent.setup()
    const note = createNote({
      blockShareAccessWarnings: [
        {
          campaignMemberId: testId('player-1'),
          blockCount: 1,
        },
        {
          campaignMemberId: testId('player-2'),
          blockCount: 3,
        },
      ],
    })

    renderNoteEditor(note)

    const warning = screen.getByTestId('block-share-access-warning')
    expect(warning).toHaveAccessibleName(
      'There are blocks that are shared with Player One and Second Player.',
    )

    await user.click(warning)
    await user.click(screen.getByRole('button', { name: 'Share note' }))

    expect(setParticipantPermissionMock).toHaveBeenCalledTimes(2)
    expect(setParticipantPermissionMock).toHaveBeenCalledWith({
      itemIds: [note.id],
      participantId: testId('player-1'),
      permissionLevel: PERMISSION_LEVEL.VIEW,
    })
    expect(setParticipantPermissionMock).toHaveBeenCalledWith({
      itemIds: [note.id],
      participantId: testId('player-2'),
      permissionLevel: PERMISSION_LEVEL.VIEW,
    })
  })

  it('keeps the share warning dialog open after a partial grant failure', async () => {
    const user = userEvent.setup()
    const sourcesetParticipantPermissionMock = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('share failed'))
    const note = createNote({
      blockShareAccessWarnings: [
        {
          campaignMemberId: testId('player-1'),
          blockCount: 1,
        },
        {
          campaignMemberId: testId('player-2'),
          blockCount: 3,
        },
      ],
    })

    renderNoteEditor(note, {
      setParticipantPermission: sourcesetParticipantPermissionMock,
    })

    await user.click(screen.getByTestId('block-share-access-warning'))
    await user.click(screen.getByRole('button', { name: 'Share note' }))

    await waitFor(() => {
      expect(sourcesetParticipantPermissionMock).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByRole('dialog')).toHaveTextContent('Share this note with these players?')
  })

  it('absolutely positions the warning control under the toolbar area', () => {
    renderNoteEditor(
      createNote({
        blockShareAccessWarnings: [
          {
            campaignMemberId: testId('player-1'),
            blockCount: 2,
          },
        ],
      }),
    )

    expect(screen.getByTestId('block-share-access-warning-container')).toHaveClass(
      'absolute',
      'top-12',
      'left-2',
    )
  })
})

function createNote(overrides: Partial<NoteItemWithContent> = {}): NoteItemWithContent {
  return {
    createdAt: 1,
    id: testId('note-id'),
    allPermissionLevel: null,
    ancestors: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    campaignId: testId('campaign-id'),
    color: null,
    content: [],
    createdBy: testId('user-id'),
    deletedBy: null,
    deletionTime: null,
    iconName: null,
    isBookmarked: false,
    status: 'active',
    myPermissionLevel: 'full_access',
    name: 'Note',
    parentId: null,
    previewAssetId: null,
    previewUrl: null,
    shares: [],
    slug: 'note',
    type: RESOURCE_TYPES.notes,
    updatedBy: null,
    updatedTime: null,
    ...overrides,
  } as unknown as NoteItemWithContent
}

interface CreateNoteEditorSourceOptions {
  canEdit?: boolean
  editorMode?: NoteEditorSource['editorMode']
  noteScrollRequest?: NoteScrollRequest
  scrollStore?: NoteEditorSource['scrollStore']
  setParticipantPermission?: NoteEditorSetParticipantPermission
}

function renderNoteEditor(note: NoteItemWithContent, options: CreateNoteEditorSourceOptions = {}) {
  return render(<NoteEditor item={note} source={createNoteEditorSource(options)} />)
}

function createParticipant(id: string, name: string, email: string): EditorShareParticipant {
  return {
    id,
    displayName: name,
    profileId: `${id}-user`,
    username: email.split('@')[0] ?? name.toLowerCase().replaceAll(' ', '-'),
    imageUrl: null,
  }
}

function createNoteEditorSource({
  canEdit = true,
  editorMode = WORKSPACE_MODE.EDITOR,
  setParticipantPermission = setParticipantPermissionMock,
  noteScrollRequest = { status: 'none' },
  scrollStore = createTestNoteScrollStore(),
}: CreateNoteEditorSourceOptions = {}): NoteEditorSource {
  return {
    canEdit,
    editorMode,
    documentSource: createTestNoteDocumentContentSource(),
    embeddedNoteContentSource: createTestEmbeddedNoteContentSource(),
    embedTargetSource: createTestNoteEmbedTargetSource(),
    linkCreationSource: null,
    linkNavigationSource: createTestNoteLinkNavigationSource(),
    linkResolutionSource: createTestNoteLinkResolutionSource(),
    noteValueReferences: createTestNoteValueReferences(),
    noteValueStateSource: createTestNoteValueStateSource(),
    permissionSource: createTestNotePermissionContentSource(),
    playbackSource: createTestNotePlaybackContentSource(),
    scrollRequest: noteScrollRequest,
    scrollStore,
    sharingSource: createTestNoteSharingContentSource(),
    sharing: {
      status: 'available',
      participants,
      setParticipantPermission,
    },
    wikiLinkSource: createTestNoteWikiLinkContentSource(),
  }
}

function createTestNoteScrollStore(): NoteScrollStore {
  return {
    loadNoteScrollTop: () => 0,
    saveNoteScrollTop: () => undefined,
  }
}

const EMPTY_WIKI_LINK_AUTOCOMPLETE_ITEM_SOURCE: WikiLinkAutocompleteItemSource = {
  getItemBreadcrumbs: () => '',
  getItemLinkPath: () => [],
  queryItems: () => [],
  resolveFolderPath: () => null,
  resolveItemPath: () => null,
  resolveNotePath: () => null,
}

const EMPTY_WIKI_LINK_AUTOCOMPLETE_MODEL_DATA: WikiLinkAutocompleteModelData = {
  context: null,
  headingsPending: false,
  model: buildWikiLinkAutocompleteModelFromSource({
    context: null,
    headings: [],
    itemSource: EMPTY_WIKI_LINK_AUTOCOMPLETE_ITEM_SOURCE,
    values: [],
  }),
  valuesPending: false,
}

function createTestEmbeddedNoteContentSource(): EmbeddedNoteContentSource {
  return {}
}

function createTestNoteEmbedTargetSource(): NoteEmbedTargetContentSource {
  return {
    embedTargetOperations: undefined,
  }
}

function createTestNoteLinkNavigationSource(): NoteLinkNavigationSource | null {
  return null
}

function createTestNoteLinkResolutionSource(): NoteLinkResolutionSource {
  return {
    revision: 'test',
    resolveItemPath: () => null,
  }
}

function createTestNoteValueReferences(): NoteValueReferences {
  return {
    getNoteCandidates: () => [],
    resolveNoteIdByPath: () => null,
  }
}

function createTestNoteValueStateSource(): NoteValueRuntimeStateSource {
  return {
    useNoteValueStates: () => ({
      states: [],
      status: 'success',
    }),
  }
}

function createTestNoteDocumentContentSource(): NoteDocumentContentSource {
  return {
    useNoteCollaborationSession: () => ({
      instanceId: 'test-note-session',
      mode: 'editable',
      reason: 'missing_collaboration_engine',
      status: 'unavailable',
      user: { color: '#000', name: 'Test User' },
    }),
  }
}

function createTestNotePlaybackContentSource(): NotePlaybackContentSource {
  return {}
}

function createTestNoteSharingContentSource(): NoteSharingContentSource {
  return {
    blocks: { status: 'unsupported', reason: 'not_available' },
  }
}

function createTestNoteWikiLinkContentSource(): NoteWikiLinkContentSource {
  return {
    useWikiLinkAutocompleteModelData: () => EMPTY_WIKI_LINK_AUTOCOMPLETE_MODEL_DATA,
  }
}

function createTestNotePermissionContentSource(): NotePermissionContentSource {
  return {
    canAccessItem: () => true,
    getMemberItemPermissionLevel: () => PERMISSION_LEVEL.FULL_ACCESS,
    selectedViewAsPlayerId: undefined,
  }
}

function testId<T extends string>(value: string): T {
  return value as T
}
