import { render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SHARE_STATUS } from 'shared/editor-blocks/share-status'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { NoteContent } from '../note-content'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { createTestCanvasViewerSource } from '~/test/factories/canvas-viewer-source-factory'
import { testId } from '~/test/helpers/test-id'
import { EditorWorkspaceSourceProvider } from '~/features/editor/workspace/editor-workspace-source-context'
import { LIVE_EDITOR_WORKSPACE_NOTE_DOCUMENTS } from '~/features/editor/workspace/live-note-document-source'
import type * as BlockNoteCore from '@blocknote/core'
import type { Id } from 'convex/_generated/dataModel'
import type { Doc } from 'yjs'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { NoteWithContent } from 'shared/notes/types'
import type { CampaignActor } from 'shared/campaigns/actor'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { NoteValueRuntimeSource } from '~/features/editor/value-block/note-value-runtime-source'
import type {
  EditorNoteCollaborationProvider,
  EditorWorkspaceNoteDocuments,
  EditorWorkspaceSource,
} from '~/features/editor/workspace/editor-workspace-source'

const {
  activeItemsState,
  blockNoteCreateMock,
  campaignState,
  editorModeState,
  noteSessionState,
  noteViewSpy,
} = vi.hoisted(() => ({
  activeItemsState: { itemsMap: new Map() },
  blockNoteCreateMock: vi.fn((options: { initialContent?: Array<CustomBlock> }) => ({
    document: options.initialContent ?? [],
    replaceBlocks: vi.fn(function replaceBlocks(
      this: { document: Array<CustomBlock> },
      _oldBlocks: Array<CustomBlock>,
      newBlocks: Array<CustomBlock>,
    ) {
      this.document = newBlocks
    }),
    _tiptapEditor: { destroy: vi.fn() },
  })),
  campaignState: { isDm: false as boolean | undefined },
  editorModeState: {
    campaignActor: {
      kind: 'player',
      campaignId: 'campaign_1' as Id<'campaigns'>,
    } as CampaignActor | null,
    viewAsPlayerId: undefined as Id<'campaignMembers'> | undefined,
  },
  noteSessionState: {
    error: null as Error | null,
    isLoading: false,
  },
  noteViewSpy: vi.fn(),
}))

vi.mock('@blocknote/core', async (importOriginal) => {
  const actual = await importOriginal<typeof BlockNoteCore>()
  return {
    ...actual,
    BlockNoteEditor: {
      create: blockNoteCreateMock,
    },
  }
})

vi.mock('../note-view', () => ({
  NoteView: ({
    editor,
    editable,
    editableChrome,
    note,
    noteId,
    children,
  }: {
    editor: CustomBlockNoteEditor
    editable: boolean
    note?: NoteWithContent
    noteId?: Id<'sidebarItems'>
    editableChrome?: ReactNode
    children?: ReactNode
  }) => {
    noteViewSpy({ editor, editable, editableChrome, note, noteId })
    return <div data-testid="note-view">{children}</div>
  },
}))

vi.mock('../extensions/link-click-handler', () => ({
  LinkClickHandler: () => null,
  LinkClickHandlerSurface: () => null,
}))

vi.mock('../extensions/wiki-link/live-wiki-link-autocomplete', () => ({
  LiveWikiLinkAutocomplete: () => null,
}))

vi.mock('../extensions/wiki-link/wiki-link-autocomplete', () => ({
  WikiLinkAutocomplete: () => null,
}))

vi.mock('~/features/editor/hooks/useLinkResolver', () => ({
  useLinkResolver: (
    _noteId: Id<'sidebarItems'> | undefined,
    options: { isViewerMode: boolean },
  ) => ({
    isViewerMode: options.isViewerMode,
    resolveLink: vi.fn(),
  }),
}))

vi.mock('~/features/editor/value-block/use-live-note-value-runtime-source', () => ({
  useLiveNoteValueRuntimeSource: ({
    noteId,
  }: {
    noteId?: Id<'sidebarItems'>
  }): NoteValueRuntimeSource => ({
    noteId,
    authoredDefinitions: [],
    externalNoteIdByPath: new Map(),
    externalStates: [],
    itemsMap: new Map(),
    persistedStates: [],
    sidebarItems: [],
  }),
}))

vi.mock('~/features/editor/hooks/useNoteYjsCollaboration', () => ({
  useNoteYjsCollaboration: () => ({
    doc: { getXmlFragment: vi.fn(() => ({})) },
    provider: { awareness: { setLocalStateField: vi.fn() } },
    instanceId: 1,
    isLoading: noteSessionState.isLoading,
    error: noteSessionState.error,
  }),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({
    data: { _id: testId<'userProfiles'>('user-1'), name: 'Test User' },
  }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => campaignState,
}))

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: () => editorModeState,
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => activeItemsState,
}))

vi.mock('~/features/filesystem/useFileSystemReadModel', () => ({
  useFileSystemReadModel: () => ({ allItemsById: activeItemsState.itemsMap }),
}))

describe('NoteContent', () => {
  beforeEach(() => {
    activeItemsState.itemsMap = new Map()
    blockNoteCreateMock.mockClear()
    campaignState.isDm = false
    noteSessionState.error = null
    noteSessionState.isLoading = false
    editorModeState.campaignActor = {
      kind: 'player',
      campaignId: testId<'campaigns'>('campaign_1'),
    }
    editorModeState.viewAsPlayerId = undefined
    noteViewSpy.mockReset()
  })

  it('filters live note blocks before rendering read-only content', async () => {
    const visibleBlock = createBlock('visible-block')
    const hiddenBlock = createBlock('hidden-block')
    const note = createNoteWithContent({
      content: [visibleBlock, hiddenBlock],
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
      blockMeta: {
        [visibleBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
      },
    })

    renderNoteContent(note, { editable: false })

    await waitFor(() => {
      expect(noteViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          editable: false,
          editor: expect.objectContaining({
            document: [visibleBlock],
          }),
          note,
          noteId: note._id,
        }),
      )
    })
  })

  it('renders collaborative editing when the note is editable', async () => {
    const visibleBlock = createBlock('visible-block')
    const hiddenBlock = createBlock('hidden-block')
    const note = createNoteWithContent({
      content: [visibleBlock, hiddenBlock],
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
      blockMeta: {
        [visibleBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
      },
    })

    renderNoteContent(note, { editable: true })

    await waitFor(() => {
      expect(noteViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          editable: true,
          note,
        }),
      )
    })
    expect(blockNoteCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collaboration: expect.any(Object),
      }),
    )
  })

  it('uses source note document capabilities with the shared editable note chrome', async () => {
    const visibleBlock = createBlock('visible-block')
    editorModeState.campaignActor = {
      kind: 'player',
      campaignId: testId<'campaigns'>('campaign_1'),
    }
    const note = createNoteWithContent({
      content: [visibleBlock],
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
      blockMeta: {
        [visibleBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
      },
    })
    const sourceNoteDocuments = createSourceNoteDocuments(note._id)

    render(
      <EditorWorkspaceSourceProvider value={createWorkspaceSource(note, sourceNoteDocuments)}>
        <NoteContent note={note} editable />
      </EditorWorkspaceSourceProvider>,
    )

    await waitFor(() => {
      expect(noteViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          editable: true,
          editableChrome: expect.anything(),
          note,
        }),
      )
    })
    expect(blockNoteCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collaboration: expect.any(Object),
      }),
    )
  })

  it('can opt read-only embedded notes into the fill-height editor wrapper', async () => {
    const note = createNoteWithContent({
      content: [createBlock('visible-block')],
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
      blockMeta: {
        'visible-block': {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
      },
    })

    renderNoteContent(note, { editable: false, fillHeight: true })

    await waitFor(() => {
      expect(screen.getByTestId('note-view').closest('.note-editor-fill-height')).not.toBeNull()
    })
  })

  it('shows a failed state instead of mounting the editor when collaboration errors', () => {
    noteSessionState.error = new Error('Collaboration failed')
    const note = createNoteWithContent({
      content: [createBlock('visible-block')],
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
      blockMeta: {},
    })

    renderNoteContent(note, { editable: true })

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load note content.')
    expect(noteViewSpy).not.toHaveBeenCalled()
    expect(blockNoteCreateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        collaboration: expect.any(Object),
      }),
    )
  })

  it('filters live note blocks using player visibility in DM view-as mode', async () => {
    const playerId = testId<'campaignMembers'>('player-1')
    const allSharedBlock = createBlock('all-shared-block')
    const playerSharedBlock = createBlock('player-shared-block')
    const otherPlayerBlock = createBlock('other-player-block')
    const missingMetaBlock = createBlock('missing-meta-block')
    campaignState.isDm = true
    editorModeState.campaignActor = {
      kind: 'dm_view_as',
      campaignId: testId<'campaigns'>('campaign_1'),
      memberId: playerId,
    }
    editorModeState.viewAsPlayerId = playerId

    const note = createNoteWithContent({
      content: [allSharedBlock, playerSharedBlock, otherPlayerBlock, missingMetaBlock],
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
      blockMeta: {
        [allSharedBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
        [playerSharedBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
          sharedWith: [playerId],
        },
        [otherPlayerBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.NONE,
          shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
          sharedWith: [testId<'campaignMembers'>('player-2')],
        },
      },
    })

    renderNoteContent(note, { editable: false })

    await waitFor(() => {
      expect(noteViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          editable: false,
          editor: expect.objectContaining({
            document: [allSharedBlock, playerSharedBlock],
          }),
        }),
      )
    })
  })

  it('shows every block in DM view-as mode when the viewed player has edit note permission', async () => {
    const playerId = testId<'campaignMembers'>('player-1')
    const hiddenByDefaultBlock = createBlock('hidden-by-default-block')
    campaignState.isDm = true
    editorModeState.campaignActor = {
      kind: 'dm_view_as',
      campaignId: testId<'campaigns'>('campaign_1'),
      memberId: playerId,
    }
    editorModeState.viewAsPlayerId = playerId

    const baseNote = createNoteWithContent({
      content: [hiddenByDefaultBlock],
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
      blockMeta: {
        [hiddenByDefaultBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.NONE,
          shareStatus: SHARE_STATUS.NOT_SHARED,
          sharedWith: [],
        },
      },
    })
    const note = {
      ...baseNote,
      shares: [
        {
          _id: testId<'sidebarItemShares'>('note-share-1'),
          _creationTime: 1,
          campaignId: baseNote.campaignId,
          sidebarItemId: baseNote._id,
          sidebarItemType: baseNote.type,
          campaignMemberId: playerId,
          sessionId: null,
          permissionLevel: PERMISSION_LEVEL.EDIT,
        },
      ],
    }
    activeItemsState.itemsMap = new Map([[note._id, note]])

    renderNoteContent(note, { editable: false })

    await waitFor(() => {
      expect(noteViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          editable: false,
          editor: expect.objectContaining({
            document: [hiddenByDefaultBlock],
          }),
        }),
      )
    })
  })

  it('keeps DM view-as rendering static and in viewer link mode', async () => {
    const playerId = testId<'campaignMembers'>('player-1')
    const visibleBlock = createBlock('visible-block')
    campaignState.isDm = true
    editorModeState.campaignActor = {
      kind: 'dm_view_as',
      campaignId: testId<'campaigns'>('campaign_1'),
      memberId: playerId,
    }
    editorModeState.viewAsPlayerId = playerId

    const note = createNoteWithContent({
      content: [visibleBlock],
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
      blockMeta: {
        [visibleBlock.id]: {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
      },
    })
    activeItemsState.itemsMap = new Map([[note._id, note]])

    renderNoteContent(note, { editable: true })

    await waitFor(() => {
      expect(noteViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          editable: false,
          editor: expect.objectContaining({
            document: [visibleBlock],
          }),
        }),
      )
    })
    expect(blockNoteCreateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        collaboration: expect.any(Object),
      }),
    )
  })
})

function createBlock(id: string): CustomBlock {
  return { id, type: 'paragraph', content: [] } as unknown as CustomBlock
}

function renderNoteContent(
  note: NoteWithContent,
  props: Omit<ComponentProps<typeof NoteContent>, 'note'>,
  source: EditorWorkspaceSource = createWorkspaceSource(note),
) {
  return render(
    <EditorWorkspaceSourceProvider value={source}>
      <NoteContent note={note} {...props} />
    </EditorWorkspaceSourceProvider>,
  )
}

function createNoteWithContent({
  content,
  myPermissionLevel,
  allPermissionLevel,
  blockMeta,
}: Pick<NoteWithContent, 'content' | 'myPermissionLevel' | 'blockMeta'> &
  Partial<Pick<NoteWithContent, 'allPermissionLevel'>>): NoteWithContent {
  return {
    ...createNote({
      _id: testId<'sidebarItems'>('note-1'),
      myPermissionLevel,
      allPermissionLevel,
    }),
    ancestors: [],
    content,
    blockMeta,
    blockShareAccessWarnings: [],
  }
}

function createWorkspaceSource(
  note: NoteWithContent,
  noteDocuments: EditorWorkspaceNoteDocuments = LIVE_EDITOR_WORKSPACE_NOTE_DOCUMENTS,
): EditorWorkspaceSource {
  const campaignId = note.campaignId
  return {
    content: {
      currentItem: {
        item: note,
        contentItem: note,
        editorSearch: { item: note.slug },
        isLoading: false,
        itemError: null,
        hasRequestedItem: true,
      },
      requestedSlug: note.slug,
      canViewCurrentItem: true,
      availabilityState: { status: 'available', label: note.name, item: note },
    },
    permissions: {
      editorMode: 'editor',
      canEdit: true,
      campaignActor: editorModeState.campaignActor,
      viewAsPlayerId: editorModeState.viewAsPlayerId,
      setEditorMode: vi.fn(),
      setViewAsPlayerId: vi.fn(),
      viewAsPlayer: {
        isPending: false,
        playerMembers: [],
        selectedPlayerId: undefined,
        setSelectedPlayerId: vi.fn(),
        visible: false,
      },
    },
    index: {
      activeItemsById:
        activeItemsState.itemsMap.size > 0
          ? activeItemsState.itemsMap
          : new Map([[note._id, note]]),
      trashItems: [],
    },
    workspace: {
      campaignId,
      isCampaignLoaded: true,
      isDm: campaignState.isDm,
    },
    items: {
      itemActions: {
        enabled: false,
        item: note,
      },
      createItem: vi.fn(() => null),
      createMissingRequestedNote: vi.fn(),
      creationDraft: {
        pendingName: '',
        setPendingName: vi.fn(),
      },
      emptyWorkspaceDrop: {
        status: 'disabled',
        reason: 'unsupported',
      },
      isCreatingMissingRequestedNote: false,
      renameItem: vi.fn(),
      validateItemName: vi.fn(() => ({ valid: true as const })),
    },
    navigation: {
      openItem: vi.fn(),
      openItemBySlug: vi.fn(),
      getItemLinkProps: vi.fn(() => null),
    },
    history: {
      preview: {
        previewingEntryId: null,
        clearItemSession: vi.fn(),
        PreviewComponent: () => null,
      },
      rollback: {
        DialogComponent: () => null,
      },
    },
    sharing: {
      visible: false,
    },
    files: {
      viewer: {
        resolveFile: (file) => ({
          allowObjectUrl: false,
          contentType: file.contentType,
          downloadUrl: file.downloadUrl,
          name: file.name,
          size: null,
        }),
        getEmptyFileUpload: () => null,
      },
    },
    documents: {
      canvases: {
        viewer: createTestCanvasViewerSource(),
      },
      notes: noteDocuments,
    },
  }
}

function createSourceNoteDocuments(noteId: Id<'sidebarItems'>): EditorWorkspaceNoteDocuments {
  const items: Array<AnySidebarItem> = []
  return {
    kind: 'client',
    getSidebarItems: () => ({
      items,
      itemsMap: new Map(),
      parentItemsMap: new Map(),
    }),
    createEditableSession: () => ({
      destroy: vi.fn(),
      doc: { getXmlFragment: vi.fn(() => ({})) } as unknown as Doc,
      error: null,
      instanceId: `source:${noteId}`,
      isLoading: false,
      provider: createCollaborationProvider(),
      user: { name: 'Source User', color: '#61afef' },
    }),
    createLinkResolver: (_noteId, { isViewerMode }) => ({
      allItems: [],
      isViewerMode,
      itemsMap: new Map(),
      resolveLink: vi.fn(),
    }),
    createValueRuntimeSource: () => createNoteValueRuntimeSource(noteId),
  }
}

function createCollaborationProvider(): EditorNoteCollaborationProvider {
  const doc = { getXmlFragment: vi.fn(() => ({})) } as unknown as Doc
  return {
    awareness: {
      setLocalStateField: vi.fn(),
    } as unknown as EditorNoteCollaborationProvider['awareness'],
    destroy: vi.fn(),
    doc,
    emit: vi.fn(),
    flushUpdates: vi.fn(() => Promise.resolve()),
    off: vi.fn(),
    on: vi.fn(),
  }
}

function createNoteValueRuntimeSource(noteId: Id<'sidebarItems'>): NoteValueRuntimeSource {
  return {
    noteId,
    authoredDefinitions: [],
    externalNoteIdByPath: new Map(),
    externalStates: [],
    itemsMap: new Map(),
    persistedStates: [],
    sidebarItems: [],
  }
}
