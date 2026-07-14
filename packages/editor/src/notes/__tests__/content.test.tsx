import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { SHARE_STATUS } from '../../../../../shared/block-shares/share-status'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { NoteContent } from '../content'
import { createNote } from '../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../test/workspace-runtime-factory'
import {
  createTestNoteHeadingSessionPorts,
  createTestNotePlaybackSessionPorts,
  createTestNoteSessionPorts,
  createTestNoteSessionPortsWithSession,
  createTestNoteValueSessionPorts,
} from '../../test/workspace-note-session-source-factory'
import { testId } from '../../test/id'
import { testResourceShareId } from '../../test/resource-share-id'
import { DOMAIN_ID_KIND } from '../../resources/domain-id'
import { testDomainId } from '../../test/domain-id'
import { createRuntimeNoteContentSource } from '../runtime-content-source'
import type * as BlockNoteCore from '@blocknote/core'
import type { Doc } from 'yjs'
import type { NoteBlock } from '../document/model'
import type { CustomBlockNoteEditor } from '../editor-schema'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { WorkspaceRuntime } from '../../workspace/runtime'
import type { YjsCollaborationProvider } from '../../collaboration/yjs-provider'
import type { NoteEditorSession } from '../session-contract'
import type {
  NoteHeadingSessionPorts,
  NotePlaybackSessionPorts,
  NoteSessionPorts,
  NoteValueSessionPorts,
} from '../workspace-session-source'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { CampaignMemberId } from '../../resources/domain-id'
import type * as ImportedTextModule from '../imported-text'

const { activeItemsState, blockNoteCreateMock, viewAsState, noteSessionState, noteViewSpy } =
  vi.hoisted(() => ({
    activeItemsState: { itemsMap: new Map() },
    blockNoteCreateMock: vi.fn((options: { initialContent?: Array<NoteBlock> }) => ({
      document: options.initialContent ?? [],
      replaceBlocks: vi.fn(function replaceBlocks(
        this: { document: Array<NoteBlock> },
        _oldBlocks: Array<NoteBlock>,
        newBlocks: Array<NoteBlock>,
      ) {
        this.document = newBlocks
      }),
      _tiptapEditor: { destroy: vi.fn(), off: vi.fn(), on: vi.fn() },
      prosemirrorView: { state: {} },
    })),
    viewAsState: {
      viewAsPlayerId: undefined as CampaignMemberId | undefined,
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

vi.mock('../view', () => ({
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
    note?: NoteItemWithContent
    noteId?: SidebarItemId
    editableChrome?: ReactNode
    children?: ReactNode
  }) => {
    noteViewSpy({ editor, editable, editableChrome, note, noteId })
    return <div data-testid="note-view">{children}</div>
  },
}))

vi.mock('../link-click-handler', () => ({
  LinkClickHandlerSurface: () => null,
}))

vi.mock('../wiki-link/autocomplete', () => ({
  WikiLinkAutocomplete: () => null,
}))

vi.mock('../imported-text', async (importOriginal) => {
  const actual = await importOriginal<typeof ImportedTextModule>()
  const { Doc } = await import('yjs')
  return {
    ...actual,
    createNoteYDocFromContent: vi.fn(() => new Doc()),
  }
})

describe('NoteContent', () => {
  beforeEach(() => {
    activeItemsState.itemsMap = new Map()
    blockNoteCreateMock.mockClear()
    noteSessionState.error = null
    noteSessionState.isLoading = false
    viewAsState.viewAsPlayerId = undefined
    noteViewSpy.mockReset()
  })

  it('keeps note content helpers on narrowed feature sources', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'packages/editor/src/notes/content.tsx'),
      'utf8',
    )

    const broadSourceProps = source.match(/source: NoteContentSource/g) ?? []
    expect(broadSourceProps).toHaveLength(0)
    expect(source).not.toMatch(/\bNoteContentSource,/)
    expect(source).not.toContain('EditableNoteContentSource')
    expect(source).not.toContain('NoteEditableFeatureContentSource')
    expect(source).toContain('documentSource: NoteDocumentContentSource')
    expect(source).toContain('linkCreationSource: NoteLinkCreationSource | null')
    expect(source).toContain('playbackSource: NotePlaybackContentSource')
    expect(source).toContain('sharingSource: NoteSharingContentSource')
    expect(source).toContain('wikiLinkSource: NoteWikiLinkContentSource')
    expect(source).not.toContain('ReadonlyNoteContentSource')
    expect(source).toContain('embeddedNoteContentSource: EmbeddedNoteContentSource')
    expect(source).toContain('embedTargetSource: NoteEmbedTargetContentSource')
    expect(source).toContain('linkNavigationSource: NoteLinkNavigationSource | null')
    expect(source).toContain('linkResolutionSource: NoteLinkResolutionSource')
    expect(source).toContain('noteValueReferences: NoteValueReferences')
    expect(source).toContain('noteValueStateSource: NoteValueRuntimeStateSource')
    expect(source).toContain('permissionsSource: NotePermissionContentSource')
    expect(source).not.toContain('source.document')
    expect(source).not.toContain('source.linkCreation')
    expect(source).not.toContain('source.playback')
    expect(source).not.toContain('source.permissions')
    expect(source).not.toContain('source.sharing')
    expect(source).not.toContain('source.wikiLinks')
    expect(source).not.toContain('CollaborativeNoteEditorSource')
    expect(source).not.toContain('createDetachedNotePlaybackProvider')
    expect(source).not.toContain('syncHandlers')
    expect(source).not.toContain('new Awareness')
    expect(source).toContain('createDetachedNotePlaybackEngine')
  })

  it('keeps note content sharing scoped to block sharing', () => {
    const runtimeSource = readFileSync(
      path.resolve(process.cwd(), 'packages/editor/src/notes/runtime.ts'),
      'utf8',
    )
    const factorySource = readFileSync(
      path.resolve(process.cwd(), 'packages/editor/src/notes/runtime-content-source.ts'),
      'utf8',
    )

    expect(runtimeSource).toContain('export interface NoteSharingContentSource')
    expect(runtimeSource).toContain('blocks: BlocksShareSource')
    expect(runtimeSource).not.toContain('items: ResourceShareSource')
    expect(factorySource).not.toContain('items: ResourceShareSource')
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
          noteId: note.id,
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
        disableExtensions: ['link', 'dropFile'],
      }),
    )
  })

  it('uses source note document capabilities with the shared editable note chrome', async () => {
    const visibleBlock = createBlock('visible-block')
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
    const sourceNoteContent = createSourceNoteContent(note.id)
    const runtime = createWorkspaceRuntime(note, { noteSession: sourceNoteContent })

    const source = createNoteContentSource(runtime)
    render(
      <NoteContent
        note={note}
        editable
        documentSource={source.document}
        embeddedNoteContentSource={source.embeddedNotes}
        embedTargetSource={source.embedTargets}
        linkCreationSource={source.linkCreation}
        linkNavigationSource={source.linkNavigation}
        linkResolutionSource={source.linkResolution}
        noteValueReferences={source.valueReferences}
        noteValueStateSource={source.valueState}
        playbackSource={source.playback}
        permissionsSource={source.permissions}
        sharingSource={source.sharing}
        wikiLinkSource={source.wikiLinks}
      />,
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
        disableExtensions: ['link', 'dropFile'],
      }),
    )
  })

  it('renders collaboration playback through an isolated provider', async () => {
    const note = createNoteWithContent({
      content: [createBlock('visible-block'), createBlock('typing-block')],
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
      blockMeta: {},
    })
    const liveDoc = createCollaborationDoc()
    const liveSetLocalStateField = vi.fn()
    const liveProvider = createCollaborationProvider(liveDoc, liveSetLocalStateField)
    const sourceNoteSession = createTestNoteSessionPorts({
      useCollaborationSession: () => ({
        engine: { doc: liveDoc, provider: liveProvider },
        instanceId: `source:${note.id}`,
        mode: 'editable',
        status: 'ready',
        user: { name: 'Source User', color: '#61afef' },
      }),
    })
    const sourceNotePlayback = createTestNotePlaybackSessionPorts({
      getCollaborationPlayback: () => ({
        collaborators: [],
        initialTypingStep: 4,
        noteId: note.id,
        typingBlockIndex: 1,
        typingText: 'typed playback text',
      }),
    })
    const runtime = createWorkspaceRuntime(note, {
      noteSession: sourceNoteSession,
      notePlayback: sourceNotePlayback,
    })

    const source = createNoteContentSource(runtime)
    render(
      <NoteContent
        note={note}
        editable
        documentSource={source.document}
        embeddedNoteContentSource={source.embeddedNotes}
        embedTargetSource={source.embedTargets}
        linkCreationSource={source.linkCreation}
        linkNavigationSource={source.linkNavigation}
        linkResolutionSource={source.linkResolution}
        noteValueReferences={source.valueReferences}
        noteValueStateSource={source.valueState}
        playbackSource={source.playback}
        permissionsSource={source.permissions}
        sharingSource={source.sharing}
        wikiLinkSource={source.wikiLinks}
      />,
    )

    await waitFor(() => {
      expect(blockNoteCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          collaboration: expect.any(Object),
        }),
      )
    })
    const lastBlockNoteCreateCall = blockNoteCreateMock.mock.lastCall
    expect(lastBlockNoteCreateCall).toBeDefined()
    const collaboration = (
      lastBlockNoteCreateCall![0] as {
        collaboration: { provider: YjsCollaborationProvider }
      }
    ).collaboration
    expect(collaboration.provider).not.toBe(liveProvider)
    expect(collaboration.provider.doc).not.toBe(liveDoc)
    expect(liveSetLocalStateField).not.toHaveBeenCalled()
  })

  it('shows a failed state when collaboration errors', () => {
    noteSessionState.error = new Error('Collaboration failed')
    const note = createNoteWithContent({
      content: [createBlock('visible-block')],
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
      blockMeta: {},
    })

    renderNoteContent(note, { editable: true })

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load note content.')
  })

  it('shows an unavailable state when collaboration is not loading but has no engine', () => {
    const note = createNoteWithContent({
      content: [createBlock('visible-block')],
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
      blockMeta: {},
    })
    const sourceNoteContent = createTestNoteSessionPortsWithSession({
      instanceId: `source:${note.id}`,
      mode: 'editable',
      reason: 'missing_collaboration_engine',
      status: 'unavailable',
      user: { name: 'Source User', color: '#61afef' },
    })
    const runtime = createWorkspaceRuntime(note, { noteSession: sourceNoteContent })

    renderNoteContent(note, { editable: true }, runtime)

    expect(screen.getByRole('alert')).toHaveTextContent('Note content is unavailable.')
    expect(screen.queryByLabelText('Loading note content')).not.toBeInTheDocument()
  })

  it('filters live note blocks using player visibility in DM view-as mode', async () => {
    const playerId = testDomainId(DOMAIN_ID_KIND.campaignMember, 'content_player_1')
    const allSharedBlock = createBlock('all-shared-block')
    const playerSharedBlock = createBlock('player-shared-block')
    const otherPlayerBlock = createBlock('other-player-block')
    const missingMetaBlock = createBlock('missing-meta-block')
    viewAsState.viewAsPlayerId = playerId

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
          sharedWith: [testDomainId(DOMAIN_ID_KIND.campaignMember, 'content_player_2')],
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
    const memberId = testDomainId(DOMAIN_ID_KIND.campaignMember, 'player-1')
    const playerId = memberId as unknown as NonNullable<typeof viewAsState.viewAsPlayerId>
    const hiddenByDefaultBlock = createBlock('hidden-by-default-block')
    viewAsState.viewAsPlayerId = playerId

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
          id: testResourceShareId('note-share-1'),
          createdAt: 1,
          campaignId: testDomainId(DOMAIN_ID_KIND.campaign, 'note-share-campaign'),
          sidebarItemId: baseNote.id,
          sidebarItemType: baseNote.type,
          campaignMemberId: memberId,
          sessionId: null,
          permissionLevel: PERMISSION_LEVEL.EDIT,
        },
      ],
    }
    activeItemsState.itemsMap = new Map([[note.id, note]])

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
    const playerId = testDomainId(DOMAIN_ID_KIND.campaignMember, 'static_content_player')
    const visibleBlock = createBlock('visible-block')
    viewAsState.viewAsPlayerId = playerId

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
    activeItemsState.itemsMap = new Map([[note.id, note]])

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
  })
})

function createBlock(id: string): NoteBlock {
  return { id, type: 'paragraph', content: [] } as unknown as NoteBlock
}

function renderNoteContent(
  note: NoteItemWithContent,
  props: Omit<
    ComponentProps<typeof NoteContent>,
    | 'documentSource'
    | 'embeddedNoteContentSource'
    | 'embedTargetSource'
    | 'linkCreationSource'
    | 'linkNavigationSource'
    | 'linkResolutionSource'
    | 'note'
    | 'noteValueReferences'
    | 'noteValueStateSource'
    | 'permissionsSource'
    | 'playbackSource'
    | 'sharingSource'
    | 'wikiLinkSource'
  >,
  runtime: WorkspaceRuntime = createWorkspaceRuntime(note),
) {
  const source = createNoteContentSource(runtime)
  return render(
    <NoteContent
      note={note}
      documentSource={source.document}
      embeddedNoteContentSource={source.embeddedNotes}
      embedTargetSource={source.embedTargets}
      linkCreationSource={source.linkCreation}
      linkNavigationSource={source.linkNavigation}
      linkResolutionSource={source.linkResolution}
      noteValueReferences={source.valueReferences}
      noteValueStateSource={source.valueState}
      playbackSource={source.playback}
      permissionsSource={source.permissions}
      sharingSource={source.sharing}
      wikiLinkSource={source.wikiLinks}
      {...props}
    />,
  )
}

function createNoteContentSource(runtime: WorkspaceRuntime) {
  return createRuntimeNoteContentSource({
    ...runtime,
    sessions: {
      noteDocument: runtime.sessions.note.document,
      noteHeadings: runtime.sessions.noteHeadings.headings,
      notePlayback: runtime.sessions.notePlayback.playback,
      noteValues: runtime.sessions.noteValues.values,
    },
  })
}

function createNoteWithContent({
  content,
  myPermissionLevel,
  allPermissionLevel,
  blockMeta,
}: Pick<NoteItemWithContent, 'content' | 'myPermissionLevel' | 'blockMeta'> &
  Partial<Pick<NoteItemWithContent, 'allPermissionLevel'>>): NoteItemWithContent {
  return {
    ...createNote({
      id: testId<'sidebarItems'>('note-1'),
      myPermissionLevel,
      allPermissionLevel,
    }),
    ancestors: [],
    content,
    blockMeta,
    blockShareAccessWarnings: [],
  }
}

function createWorkspaceRuntime(
  note: NoteItemWithContent,
  sources: {
    noteHeadings?: NoteHeadingSessionPorts
    notePlayback?: NotePlaybackSessionPorts
    noteSession?: NoteSessionPorts
    noteValues?: NoteValueSessionPorts
  } = {},
): WorkspaceRuntime {
  const activeItems =
    activeItemsState.itemsMap.size > 0 ? Array.from(activeItemsState.itemsMap.values()) : [note]
  const resolvedNoteSession = sources.noteSession ?? createSourceNoteContent(note.id)
  return createTestWorkspaceRuntime({
    activeItems,
    canEdit: true,
    contentItem: note,
    item: note,
    noteHeadings: sources.noteHeadings ?? createTestNoteHeadingSessionPorts(),
    notePlayback: sources.notePlayback ?? createTestNotePlaybackSessionPorts(),
    noteSession: resolvedNoteSession,
    noteValues: sources.noteValues ?? createTestNoteValueSessionPorts(),
    viewAsParticipant: {
      status: 'available',
      isPending: false,
      participants: [],
      selectedParticipantId: viewAsState.viewAsPlayerId,
      setSelectedParticipantId: vi.fn(),
    },
  })
}

function createSourceNoteContent(noteId: SidebarItemId): NoteSessionPorts {
  const doc = createCollaborationDoc()
  const provider = createCollaborationProvider(doc)
  return createTestNoteSessionPortsWithSession(
    createTestNoteEditorSession({
      doc,
      error: noteSessionState.error,
      instanceId: `source:${noteId}`,
      isLoading: noteSessionState.isLoading,
      provider,
    }),
  )
}

function createTestNoteEditorSession({
  doc,
  error,
  instanceId,
  isLoading,
  provider,
}: {
  doc: Doc
  error: Error | null
  instanceId: NoteEditorSession['instanceId']
  isLoading: boolean
  provider: YjsCollaborationProvider
}): NoteEditorSession {
  const base = {
    instanceId,
    mode: 'editable' as const,
    user: { name: 'Source User', color: '#61afef' },
  }

  if (isLoading) return { ...base, status: 'loading' }
  if (error) return { ...base, error, status: 'error' }

  return {
    engine: { doc, provider },
    instanceId,
    mode: 'editable',
    status: 'ready',
    user: base.user,
  }
}

function createCollaborationDoc(): Doc {
  return { getXmlFragment: vi.fn(() => ({})) } as unknown as Doc
}

function createCollaborationProvider(
  doc: Doc = createCollaborationDoc(),
  setLocalStateField = vi.fn(),
): YjsCollaborationProvider {
  return {
    awareness: {
      setLocalStateField,
    } as unknown as YjsCollaborationProvider['awareness'],
    destroy: vi.fn(),
    doc,
    emit: vi.fn(),
    flushPendingUpdates: vi.fn(() => Promise.resolve(true)),
    flushUpdates: vi.fn(() => Promise.resolve()),
    isApplyingRemoteUpdate: vi.fn(() => false),
    off: vi.fn(),
    on: vi.fn(),
    updateUser: vi.fn(),
  }
}
