import {
  completeWizardEditorResourceCommand,
  createWizardEditorResource,
  parseWizardEditorResourceSlug,
} from '@wizard-archive/editor/adapter'
import { createWorkspaceResourceReadModel } from '@wizard-archive/editor/resources/items'
import type {
  WizardEditorItem,
  WizardEditorItemWithContent,
  WizardEditorFileSession,
  WizardEditorFileSessionReplaceInput,
  WizardEditorRuntime,
  WizardEditorResourceCommand,
  WizardEditorResourceCommandResult,
  WizardEditorResourceEvent,
  WizardEditorResourceSlug,
  WizardEditorWorkspaceActor,
  createWizardEditorFileContentSource,
} from '@wizard-archive/editor/adapter'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createFolder, createGameMap, createNote } from '~/test/factories/sidebar-item-factory'
import { useLiveWorkspaceRuntime } from '../use-live-workspace-runtime'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { WORKSPACE_MODE } from 'shared/workspace/workspace-mode'
import type { Id } from 'convex/_generated/dataModel'
import type { CampaignActor } from 'shared/campaigns/actor'
import type { CampaignMemberId as CampaignMemberRowId } from 'shared/common/ids'
import type { LiveFileSystemReadModel } from '../filesystem/read-model'
import { SHARE_STATUS } from 'shared/block-shares/share-status'
import { testMapPinId } from 'shared/test/map-pin-id'

const liveSourceState = vi.hoisted(() => ({
  contentItem: null as WizardEditorItemWithContent | null,
  editorSearch: null as Record<string, unknown> | null,
  item: null as WizardEditorItemWithContent | null,
  extraActiveItems: [] as Array<WizardEditorItem>,
  hiddenActiveItems: [] as Array<WizardEditorItem>,
}))
const availabilityStateCalls = vi.hoisted(
  () =>
    [] as Array<{
      fallbackLabel: string
      subject: string
    }>,
)
type FileSystemSearch = WizardEditorRuntime['search']['items']
type FileSystemResourceContent = WizardEditorRuntime['resources']['resourceContent']
type LiveRuntimeFileSystemHost = Parameters<typeof useLiveWorkspaceRuntime>[0]['filesystemHost']
type LiveRuntimeSidebarItemsShareOperations = Parameters<
  typeof useLiveWorkspaceRuntime
>[0]['sidebarItemsShareOperations']
type LiveRuntimeClipboardDriver = LiveRuntimeFileSystemHost['clipboardOperations']
type LiveRuntimeDropDriver = LiveRuntimeFileSystemHost['dropOperations']
type LiveRuntimeTrashDriver = LiveRuntimeFileSystemHost['trashOperations']
type CompletedResourceCommandResult = Extract<
  WizardEditorResourceCommandResult,
  { status: 'completed' }
>
type LiveRuntimeImportFile = WizardEditorFileSessionReplaceInput['file']
type LiveRuntimeImportInitializer = ReturnType<
  typeof createWizardEditorFileContentSource
>['initializeImportedFile']
type LiveRuntimeNoteItemWithContent = Extract<WizardEditorItemWithContent, { type: 'note' }>
type LiveRuntimeNoteBlock = LiveRuntimeNoteItemWithContent['content'][number]
const TEST_METADATA_COLOR = '#abcdef' as NonNullable<WizardEditorItem['color']>
function createImportFile(
  parts: Array<BlobPart>,
  name: string,
  options: FilePropertyBag,
): LiveRuntimeImportFile {
  const file = new File(parts, name, options)
  return {
    name: file.name,
    contentType: file.type,
    size: file.size,
    arrayBuffer: () => file.arrayBuffer(),
    text: () => file.text(),
  }
}

function getLiveActiveItems() {
  return [
    ...(liveSourceState.item ? [liveSourceState.item] : []),
    ...liveSourceState.extraActiveItems,
    ...liveSourceState.hiddenActiveItems,
  ]
}

function createMockFileSystemReadModel(): LiveFileSystemReadModel {
  const activeItems = getLiveActiveItems()

  return {
    activeItems,
    activeError: null,
    activeStatus: 'success',
    allItems: activeItems,
    refreshActive: vi.fn(),
    refreshTrash: vi.fn(),
    visibleTrashItems: [],
    trashError: null,
    trashStatus: 'success',
    visibleActiveItems: activeItems.filter(
      (item) => !liveSourceState.hiddenActiveItems.some((hidden) => hidden.id === item.id),
    ),
    readModel: createWorkspaceResourceReadModel(activeItems),
  }
}

const campaignState = vi.hoisted(() => ({
  campaignId: 'campaign-1' as Id<'campaigns'>,
  isCampaignLoaded: true,
  isDm: true,
}))

const workspaceModeState = vi.hoisted(() => ({
  canEdit: true,
  campaignActor: {
    kind: 'dm',
    campaignId: 'campaign-1' as CampaignActor['campaignId'],
  } as CampaignActor | null,
}))
type DmViewAsActor = Extract<CampaignActor, { kind: 'dm_view_as' }>

function toTestWorkspaceActor(actor: CampaignActor | null): WizardEditorWorkspaceActor | null {
  if (!actor) return null
  if (actor.kind === 'dm') return { kind: 'owner' }
  if (actor.kind === 'dm_view_as') {
    return { kind: 'owner_view_as', participantId: actor.memberId }
  }
  return { kind: 'participant' }
}

const fileSystemItemMocks = vi.hoisted(() => ({
  createItem: vi.fn(),
  renameItem: vi.fn(),
  setParticipantPermission: vi.fn(),
  clearParticipantPermission: vi.fn(),
  setDefaultPermission: vi.fn(),
  setFolderInheritShares: vi.fn(),
  toggleBookmarks: vi.fn(),
  executeCommand: vi.fn(),
}))

const campaignMutationMocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}))

const completedFileSystemCommandResult: CompletedResourceCommandResult = {
  status: 'completed',
  receipt: {
    transactionId: null,
    direction: 'forward',
    command: { type: 'emptyTrash' },
    events: [],
    patches: [],
    summary: {
      kind: 'noop',
      affectedCount: 0,
      createdCount: 0,
    },
    undoable: false,
  },
}

const campaignQueryMock = vi.hoisted(() => vi.fn())

const mediaImportMocks = vi.hoisted(() => ({
  appMutationQueue: [] as Array<{ mutateAsync: ReturnType<typeof vi.fn> }>,
  bindUpload: { mutateAsync: vi.fn() },
  createUploadSession: { mutateAsync: vi.fn() },
  discardUpload: { mutateAsync: vi.fn() },
  generatePdfPreviewIfNeeded: vi.fn(),
  uploadFileToUrl: vi.fn(),
}))

const previewUploadMock = vi.hoisted(() => vi.fn())
const noteSessionMocks = vi.hoisted(() => ({
  useNoteYjsCollaboration: vi.fn(),
}))
const sidebarShareMocks = vi.hoisted(() => ({
  useLiveSidebarItemsShare: vi.fn((_items: unknown, _operations: unknown) => {
    return {
      isMutating: false,
      status: 'ready' as const,
      aggregateShareStatus: 'not_shared',
    }
  }),
}))

const textImportMocks = vi.hoisted(() => ({
  convexAction: vi.fn(),
  convexQuery: vi.fn(),
}))

const navigationMocks = vi.hoisted(() => ({
  clearWorkspaceContent: vi.fn(),
  navigateToItem: vi.fn(),
  navigateToTrash: vi.fn(),
  openExternalUrl: vi.fn(),
  openLastWorkspaceItem: vi.fn(),
  openSeparateItem: vi.fn(),
  setLastSelectedItem: vi.fn(),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaign: { data: { myMembership: null } },
    campaignId: campaignState.campaignId,
    campaignSlug: 'campaign',
    dmUsername: 'dm',
    isCampaignLoaded: campaignState.isCampaignLoaded,
    isDm: campaignState.isDm,
  }),
}))

vi.mock('~/features/campaigns/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => ({ data: [], isPending: false }),
}))

vi.mock('@convex-dev/react-query', () => ({
  useConvex: () => ({ action: textImportMocks.convexAction, query: textImportMocks.convexQuery }),
}))

vi.mock('~/editor-adapters/live/use-live-current-item', () => ({
  useLiveCurrentItem: () => ({
    accessStatus: null,
    item: liveSourceState.item,
    contentItem: liveSourceState.contentItem,
    isTrashRequested: liveSourceState.editorSearch?.trash === true,
    isLoading: false,
    itemError: null,
    requestedSlug:
      typeof liveSourceState.editorSearch?.item === 'string'
        ? liveSourceState.editorSearch.item
        : liveSourceState.item?.slug,
  }),
}))

vi.mock('~/editor-adapters/live/use-live-workspace-mode', () => ({
  useLiveWorkspaceMode: () => ({
    workspaceMode: 'editor',
    campaignActor: workspaceModeState.campaignActor,
    workspaceActor: toTestWorkspaceActor(workspaceModeState.campaignActor),
    viewAsPlayerId:
      workspaceModeState.campaignActor?.kind === 'dm_view_as'
        ? workspaceModeState.campaignActor.memberId
        : undefined,
    canEdit: workspaceModeState.canEdit,
    setWorkspaceMode: vi.fn(),
    setViewAsPlayerId: vi.fn(),
  }),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => {
    const mutation = mediaImportMocks.appMutationQueue.shift()
    return mutation ?? { mutateAsync: vi.fn() }
  },
}))

vi.mock('~/shared/uploads/upload-file', () => ({
  uploadFile: (...args: Array<unknown>) => mediaImportMocks.uploadFileToUrl(...args),
}))

vi.mock('~/editor-adapters/live/previews/use-pdf-preview-upload', () => ({
  usePdfPreviewUpload: () => ({
    generatePdfPreviewIfNeeded: mediaImportMocks.generatePdfPreviewIfNeeded,
  }),
}))

vi.mock('~/editor-adapters/live/previews/use-claim-and-upload-preview', () => ({
  useClaimAndUploadPreview: () => previewUploadMock,
}))

vi.mock('~/editor-adapters/live/use-live-sidebar-item-availability-state', () => ({
  useLiveSidebarItemAvailabilityState: ({
    fallbackLabel,
    subject,
  }: {
    fallbackLabel: string
    subject: string
  }) => {
    availabilityStateCalls.push({ fallbackLabel, subject })
    return liveSourceState.contentItem
      ? {
          status: 'available',
          label: liveSourceState.contentItem.name,
          item: liveSourceState.contentItem,
        }
      : { status: 'not_found', label: fallbackLabel, message: 'Item not found.' }
  },
}))

vi.mock('~/editor-adapters/live/sharing/use-live-sidebar-items-share', () => ({
  useLiveSidebarItemsShare: (items: unknown, operations: unknown) =>
    sidebarShareMocks.useLiveSidebarItemsShare(items, operations),
}))

vi.mock('~/editor-adapters/live/use-live-workspace-navigation', () => ({
  useLiveWorkspaceNavigation: () => ({
    clearWorkspaceContent: navigationMocks.clearWorkspaceContent,
    navigateToItem: navigationMocks.navigateToItem,
    navigateToTrash: navigationMocks.navigateToTrash,
    openLastWorkspaceItem: navigationMocks.openLastWorkspaceItem,
  }),
}))

vi.mock('~/editor-adapters/live/use-last-workspace-item', () => ({
  useLastWorkspaceItem: () => ({ setLastSelectedItem: navigationMocks.setLastSelectedItem }),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: () => ({ mutateAsync: campaignMutationMocks.mutateAsync }),
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => campaignQueryMock(...args),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({ data: null, isLoading: false }),
}))

vi.mock('~/editor-adapters/live/notes/yjs-collaboration', () => ({
  useNoteYjsCollaboration: (...args: Array<unknown>) =>
    noteSessionMocks.useNoteYjsCollaboration(...args),
}))

vi.mock('~/shared/hooks/useAuthPaginatedQuery', () => ({
  useAuthPaginatedQuery: () => ({
    results: [],
    status: 'Exhausted',
    loadMore: vi.fn(),
  }),
}))

vi.mock('~/editor-adapters/live/files/session-source', () => ({
  useLiveFileSessionAdapter: (): {
    session: WizardEditorFileSession
    initializeImportedFile: LiveRuntimeImportInitializer
  } => ({
    session: {
      resolveFile: vi.fn(),
      replaceFile: vi.fn(({ fileId }) => ({
        status: 'completed' as const,
        receipt: { kind: 'fileReplaced' as const, itemId: fileId, affectedCount: 1 },
      })),
    },
    initializeImportedFile: async ({ file, fileId, onProgress }) => {
      const { sessionId } = await mediaImportMocks.createUploadSession.mutateAsync({})
      const storageId = await mediaImportMocks.uploadFileToUrl(file, 'https://upload.example', {
        onProgress,
      })
      await mediaImportMocks.bindUpload.mutateAsync({
        sessionId,
        storageId,
        originalFileName: file.name,
      })
      await campaignMutationMocks.mutateAsync({ fileId, uploadSessionId: sessionId })
      await mediaImportMocks.generatePdfPreviewIfNeeded(file, fileId)
      return {
        status: 'completed',
        receipt: { kind: 'fileImported', itemId: fileId, affectedCount: 1 },
      }
    },
  }),
}))

function createMockSidebarItemsShareOperations(): LiveRuntimeSidebarItemsShareOperations {
  return {
    setDefaultPermission: fileSystemItemMocks.setDefaultPermission,
    setParticipantPermission: fileSystemItemMocks.setParticipantPermission,
    clearParticipantPermission: fileSystemItemMocks.clearParticipantPermission,
    setFolderInheritShares: fileSystemItemMocks.setFolderInheritShares,
  }
}

function createMockFileSystemHost(): LiveRuntimeFileSystemHost {
  return {
    resourceCommands: {
      executeCommand: vi
        .fn<LiveRuntimeFileSystemHost['resourceCommands']['executeCommand']>()
        .mockImplementation(fileSystemItemMocks.executeCommand),
      discardCreatedItem:
        vi.fn<LiveRuntimeFileSystemHost['resourceCommands']['discardCreatedItem']>(),
      undo: vi.fn<LiveRuntimeFileSystemHost['resourceCommands']['undo']>(),
      redo: vi.fn<LiveRuntimeFileSystemHost['resourceCommands']['redo']>(),
      canUndo: false,
      canRedo: false,
    },
    operations: {
      createItem: fileSystemItemMocks.createItem,
      renameItem: fileSystemItemMocks.renameItem,
      toggleBookmarks: fileSystemItemMocks.toggleBookmarks,
    },
    clipboardOperations: {
      copy: vi.fn<LiveRuntimeClipboardDriver['copy']>(),
      cut: vi.fn<LiveRuntimeClipboardDriver['cut']>(),
      canUseClipboardOperations: true,
      cancelClipboard: vi.fn<LiveRuntimeClipboardDriver['cancelClipboard']>(() => false),
      canPaste: vi.fn<LiveRuntimeClipboardDriver['canPaste']>(() => false),
      paste: vi
        .fn<LiveRuntimeClipboardDriver['paste']>()
        .mockResolvedValue({ status: 'unavailable', reason: 'clipboard_empty' }),
    },
    dropOperations: {
      executeDropCommand: vi
        .fn<LiveRuntimeDropDriver['executeDropCommand']>()
        .mockResolvedValue(completedFileSystemCommandResult),
    },
    trashOperations: {
      requestTrashItems: vi
        .fn<LiveRuntimeTrashDriver['requestTrashItems']>()
        .mockResolvedValue(completeWizardEditorResourceCommand({ type: 'trash', itemIds: [] }, [])),
      restoreItems: vi
        .fn<LiveRuntimeTrashDriver['restoreItems']>()
        .mockResolvedValue(completedFileSystemCommandResult),
      confirmEmptyTrash: vi.fn<LiveRuntimeTrashDriver['confirmEmptyTrash']>(),
      confirmDeleteForever: vi.fn<LiveRuntimeTrashDriver['confirmDeleteForever']>(),
    },
    historyOperations: {
      undo: vi.fn<LiveRuntimeFileSystemHost['historyOperations']['undo']>(),
      redo: vi.fn<LiveRuntimeFileSystemHost['historyOperations']['redo']>(),
      canUndo: false,
      canRedo: false,
    },
    dialog: null,
  }
}

function createCompletedCommandResult(
  command: WizardEditorResourceCommand,
): CompletedResourceCommandResult {
  const events: Array<WizardEditorResourceEvent> =
    command.type === 'create'
      ? [{ type: 'created', itemId: 'created-item' as Id<'sidebarItems'>, slug: 'created-item' }]
      : command.type === 'rename'
        ? [
            {
              type: 'renamed',
              itemId: command.itemId,
              slug: 'renamed-note',
              previousSlug: 'note-1',
            },
          ]
        : command.type === 'toggleBookmarks'
          ? command.itemIds.map((itemId) => ({ type: 'updated', itemId }))
          : []

  return {
    ...completedFileSystemCommandResult,
    receipt: {
      ...completedFileSystemCommandResult.receipt,
      transactionId: command.type === 'create' ? ('transaction-create' as never) : null,
      command,
      events,
    },
  }
}

function createCompletedCreateCommandResult({
  command,
  itemId,
  slug,
}: {
  command: Extract<WizardEditorResourceCommand, { type: 'create' }>
  itemId: Id<'sidebarItems'>
  slug: string
}): CompletedResourceCommandResult {
  return {
    ...completedFileSystemCommandResult,
    receipt: {
      ...completedFileSystemCommandResult.receipt,
      transactionId: `${itemId}-transaction` as never,
      command,
      events: [{ type: 'created', itemId, slug }],
    },
  }
}

function renderLiveWorkspaceRuntime() {
  const host = createMockFileSystemHost()
  return renderHook(() =>
    useLiveWorkspaceRuntime({
      workspaceId: campaignState.campaignId,
      filesystemReadModel: createMockFileSystemReadModel(),
      filesystemHost: host,
      sidebarItemsShareOperations: createMockSidebarItemsShareOperations(),
      openExternalUrl: navigationMocks.openExternalUrl,
      openSeparateItem: navigationMocks.openSeparateItem,
    }),
  )
}

describe('useLiveWorkspaceRuntime', () => {
  beforeEach(() => {
    campaignState.campaignId = 'campaign-1' as Id<'campaigns'>
    liveSourceState.contentItem = createContentNote('note-1')
    liveSourceState.editorSearch = null
    liveSourceState.item = liveSourceState.contentItem
    liveSourceState.extraActiveItems = []
    liveSourceState.hiddenActiveItems = []
    availabilityStateCalls.length = 0
    campaignState.isCampaignLoaded = true
    campaignState.isDm = true
    workspaceModeState.canEdit = true
    workspaceModeState.campaignActor = {
      kind: 'dm',
      campaignId: 'campaign-1' as CampaignActor['campaignId'],
    }
    campaignMutationMocks.mutateAsync.mockReset()
    campaignQueryMock.mockReset()
    campaignQueryMock.mockReturnValue({ data: null, error: null, isPending: false })
    fileSystemItemMocks.createItem.mockReset()
    fileSystemItemMocks.renameItem.mockReset()
    fileSystemItemMocks.setParticipantPermission.mockReset()
    fileSystemItemMocks.clearParticipantPermission.mockReset()
    fileSystemItemMocks.setDefaultPermission.mockReset()
    fileSystemItemMocks.setFolderInheritShares.mockReset()
    fileSystemItemMocks.toggleBookmarks.mockReset()
    fileSystemItemMocks.executeCommand.mockReset()
    fileSystemItemMocks.executeCommand.mockImplementation((command: WizardEditorResourceCommand) =>
      createCompletedCommandResult(command),
    )
    mediaImportMocks.appMutationQueue = [
      mediaImportMocks.createUploadSession,
      mediaImportMocks.bindUpload,
      mediaImportMocks.discardUpload,
    ]
    mediaImportMocks.createUploadSession.mutateAsync.mockReset()
    mediaImportMocks.bindUpload.mutateAsync.mockReset()
    mediaImportMocks.discardUpload.mutateAsync.mockReset()
    mediaImportMocks.generatePdfPreviewIfNeeded.mockReset()
    mediaImportMocks.uploadFileToUrl.mockReset()
    previewUploadMock.mockReset()
    sidebarShareMocks.useLiveSidebarItemsShare.mockClear()
    textImportMocks.convexAction.mockReset()
    textImportMocks.convexQuery.mockReset()
    navigationMocks.openExternalUrl.mockReset()
    navigationMocks.clearWorkspaceContent.mockReset()
    navigationMocks.navigateToTrash.mockReset()
    navigationMocks.openLastWorkspaceItem.mockReset()
    navigationMocks.openSeparateItem.mockReset()
    navigationMocks.navigateToItem.mockReset()
    navigationMocks.setLastSelectedItem.mockReset()
    noteSessionMocks.useNoteYjsCollaboration.mockReset()
    fileSystemItemMocks.createItem.mockResolvedValue({
      id: 'created-note' as Id<'sidebarItems'>,
      slug: 'created-note',
    })
    fileSystemItemMocks.renameItem.mockResolvedValue({ slug: 'renamed-note' })
    mediaImportMocks.createUploadSession.mutateAsync.mockResolvedValue({
      sessionId: 'upload-session-1',
      uploadUrl: 'https://upload.example',
    })
    mediaImportMocks.uploadFileToUrl.mockResolvedValue('storage-2')
    mediaImportMocks.bindUpload.mutateAsync.mockResolvedValue(undefined)
    mediaImportMocks.discardUpload.mutateAsync.mockResolvedValue(undefined)
    noteSessionMocks.useNoteYjsCollaboration.mockReturnValue({
      doc: null,
      error: null,
      instanceId: 'note-session-1',
      isLoading: false,
      provider: null,
    })
  })

  it('exposes live download loading through the filesystem runtime', async () => {
    textImportMocks.convexQuery.mockResolvedValue({ items: [] })
    const { result } = renderLiveWorkspaceRuntime()

    expect(result.current.io.download.status).toBe('available')
    if (result.current.io.download.status !== 'available') {
      throw new Error('Expected available download capability')
    }

    await expect(result.current.io.download.loadRootItemsForDownload()).resolves.toEqual({
      status: 'completed',
      receipt: { kind: 'downloadPrepared', affectedCount: 0 },
      items: [],
      skippedItems: [],
    })

    expect(textImportMocks.convexQuery).toHaveBeenCalled()
  })

  it('creates editor items through the filesystem operation capability', async () => {
    liveSourceState.extraActiveItems = [createFolder({ id: 'folder-1' as Id<'sidebarItems'> })]
    const { result } = renderLiveWorkspaceRuntime()

    const created = await result.current.commands.operations.createItem({
      type: 'note',
      parentTarget: {
        kind: 'direct',
        parentId: 'folder-1' as Id<'sidebarItems'>,
      },
      name: 'Session Notes',
    })
    expect(created.status).toBe('completed')
    if (created.status !== 'completed') throw new Error('Expected create to complete')
    await result.current.navigation.openItem(createWizardEditorResource(created.id))

    expect(fileSystemItemMocks.executeCommand).toHaveBeenCalledWith(
      {
        type: 'create',
        itemType: 'note',
        parentTarget: {
          kind: 'direct',
          parentId: 'folder-1',
        },
        name: 'Session Notes',
      },
      undefined,
    )
    expect(navigationMocks.setLastSelectedItem).toHaveBeenCalledWith('created-item')
    expect(navigationMocks.navigateToItem).toHaveBeenCalledWith('created-item', undefined)
  })

  it('exposes missing requested item availability through filesystem content', () => {
    liveSourceState.contentItem = null
    liveSourceState.editorSearch = { item: testResourceSlug('missing-note') }
    liveSourceState.item = null

    const { result } = renderLiveWorkspaceRuntime()
    const currentContent = result.current.resources.current

    expect(result.current.navigation.current).toEqual({ kind: 'resource', resource: null })
    expect(currentContent.availabilityState).toMatchObject({
      status: 'not_found',
      label: 'missing-note',
    })
    expect(availabilityStateCalls.at(-1)).toMatchObject({
      fallbackLabel: 'missing-note',
      subject: 'item',
    })
  })

  it('translates live trash search into the filesystem selection target', () => {
    liveSourceState.contentItem = null
    liveSourceState.editorSearch = { trash: true }
    liveSourceState.item = null

    const { result } = renderLiveWorkspaceRuntime()

    expect(result.current.navigation.current).toEqual({ kind: 'trash' })
  })

  it('targets the create surface when a loaded DM has no requested item', () => {
    liveSourceState.contentItem = null
    liveSourceState.editorSearch = {}
    liveSourceState.item = null

    const { result } = renderLiveWorkspaceRuntime()

    expect(result.current.navigation.current).toEqual({ kind: 'create' })
    expect(availabilityStateCalls.at(-1)).toMatchObject({
      fallbackLabel: 'Item',
      subject: 'item',
    })
  })

  it('keeps the create surface available for a loaded DM with read-only current content', () => {
    workspaceModeState.canEdit = false
    liveSourceState.contentItem = null
    liveSourceState.editorSearch = {}
    liveSourceState.item = null

    const { result } = renderLiveWorkspaceRuntime()

    expect(result.current.navigation.current).toEqual({ kind: 'create' })
    expect(result.current.resources.permissions.canCreateItems).toBe(true)
  })

  it('uses the active view-as actor to suppress DM-only runtime affordances', async () => {
    workspaceModeState.campaignActor = {
      kind: 'dm_view_as',
      campaignId: 'campaign-1' as CampaignActor['campaignId'],
      memberId: 'player-1' as DmViewAsActor['memberId'],
    }
    liveSourceState.contentItem = null
    liveSourceState.editorSearch = {}
    liveSourceState.item = null
    textImportMocks.convexQuery.mockResolvedValue({ items: [] })

    const { result } = renderLiveWorkspaceRuntime()

    expect(result.current.navigation.current).toEqual({ kind: 'empty' })
    expect(result.current.resources.permissions.canCreateItems).toBe(false)
    expect(result.current.resources.permissions.canManageFolders).toBe(false)
    expect(result.current.resources.permissions.canEmptyTrash).toBe(false)
    expect(result.current.io.download.status).toBe('available')
    if (result.current.io.download.status !== 'available') {
      throw new Error('Expected available download capability')
    }

    await expect(result.current.io.download.loadRootItemsForDownload()).resolves.toEqual({
      status: 'unsupported',
      reason: 'not_dm',
      items: [],
    })
    expect(textImportMocks.convexQuery).not.toHaveBeenCalled()
  })

  it('gates editable live note sessions by the requested note permission', () => {
    campaignState.isDm = false
    workspaceModeState.campaignActor = {
      kind: 'player',
      campaignId: 'campaign-1' as CampaignActor['campaignId'],
    }
    const currentEditableNote = createContentNote('note-1', 'Editable current note', {
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
    })
    const readonlyNote = createContentNote('note-2', 'Readonly linked note', {
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    liveSourceState.contentItem = currentEditableNote
    liveSourceState.item = currentEditableNote
    liveSourceState.extraActiveItems = [readonlyNote]

    renderHook(() => {
      const runtime = useLiveWorkspaceRuntime({
        workspaceId: campaignState.campaignId,
        filesystemReadModel: createMockFileSystemReadModel(),
        filesystemHost: createMockFileSystemHost(),
        sidebarItemsShareOperations: createMockSidebarItemsShareOperations(),
        openExternalUrl: navigationMocks.openExternalUrl,
        openSeparateItem: navigationMocks.openSeparateItem,
      })
      return runtime.sessions.note.document.useCollaborationSession({
        mode: 'editable',
        note: readonlyNote,
      })
    })

    expect(noteSessionMocks.useNoteYjsCollaboration).toHaveBeenCalledWith(
      'campaign-1',
      readonlyNote.id,
      expect.any(Object),
      false,
      { getNoteSlugById: expect.any(Function) },
    )
  })

  it('targets the empty surface when a loaded non-DM has no requested item', () => {
    campaignState.isDm = false
    workspaceModeState.campaignActor = {
      kind: 'player',
      campaignId: 'campaign-1' as CampaignActor['campaignId'],
    }
    liveSourceState.contentItem = null
    liveSourceState.editorSearch = {}
    liveSourceState.item = null

    const { result } = renderLiveWorkspaceRuntime()

    expect(result.current.navigation.current).toEqual({ kind: 'empty' })
  })

  it('targets the empty surface before the campaign is loaded', () => {
    campaignState.isCampaignLoaded = false
    liveSourceState.contentItem = null
    liveSourceState.editorSearch = {}
    liveSourceState.item = null

    const { result } = renderLiveWorkspaceRuntime()

    expect(result.current.navigation.current).toEqual({ kind: 'empty' })
    expect(result.current.resources.current.availabilityState).toMatchObject({
      status: 'loading',
    })
  })

  it('opens items through the filesystem selection capability with heading targets', async () => {
    const { result } = renderLiveWorkspaceRuntime()

    await result.current.navigation.openItem(
      createWizardEditorResource('note-1' as Id<'sidebarItems'>),
      {
        heading: 'Intro#Details',
      },
    )

    expect(navigationMocks.setLastSelectedItem).toHaveBeenCalledWith(liveSourceState.item!.slug)
    expect(navigationMocks.navigateToItem).toHaveBeenCalledWith(liveSourceState.item!.slug, {
      heading: 'Intro#Details',
    })
  })

  it('routes create, default, and trash navigation through the live navigation adapter', () => {
    const { result } = renderLiveWorkspaceRuntime()

    result.current.navigation.openCreateDashboard()
    result.current.navigation.openDefaultItem()
    result.current.navigation.openTrash()

    expect(navigationMocks.clearWorkspaceContent).toHaveBeenCalledExactlyOnceWith()
    expect(navigationMocks.openLastWorkspaceItem).toHaveBeenCalledExactlyOnceWith()
    expect(navigationMocks.navigateToTrash).toHaveBeenCalledExactlyOnceWith()
  })

  it('updates map images through the runtime map session source', async () => {
    const file = createImportFile(['map'], 'map.png', { type: 'image/png' })
    campaignMutationMocks.mutateAsync.mockResolvedValueOnce('replacement-token')
    const { result } = renderLiveWorkspaceRuntime()

    await expect(
      result.current.sessions.map.updateMapImage({
        file,
        mapId: 'map-1' as Id<'sidebarItems'>,
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      receipt: { kind: 'mapImageUpdated', itemId: 'map-1', affectedCount: 1 },
    })

    expect(mediaImportMocks.createUploadSession.mutateAsync).toHaveBeenCalledWith({})
    expect(mediaImportMocks.uploadFileToUrl).toHaveBeenCalledWith(file, 'https://upload.example')
    expect(mediaImportMocks.bindUpload.mutateAsync).toHaveBeenCalledWith({
      sessionId: 'upload-session-1',
      storageId: 'storage-2',
      originalFileName: 'map.png',
    })
    expect(campaignMutationMocks.mutateAsync).toHaveBeenNthCalledWith(1, {
      mapId: 'map-1',
    })
    expect(campaignMutationMocks.mutateAsync).toHaveBeenNthCalledWith(2, {
      layerId: null,
      mapId: 'map-1',
      replacementToken: 'replacement-token',
      uploadSessionId: 'upload-session-1',
    })
  })

  it('updates map pins through the runtime map session source', async () => {
    const mapPinId = testMapPinId('runtime-pin')
    campaignMutationMocks.mutateAsync.mockResolvedValueOnce([mapPinId])
    const { result } = renderLiveWorkspaceRuntime()

    const createResult = await result.current.sessions.map.pins.create({
      mapId: 'map-1' as Id<'sidebarItems'>,
      pins: [{ itemId: 'note-1' as Id<'sidebarItems'>, x: 12, y: 34 }],
    })
    await expect(
      result.current.sessions.map.pins.update({
        mapId: 'map-1' as Id<'sidebarItems'>,
        mapPinId,
        x: 56,
        y: 78,
      }),
    ).resolves.toMatchObject({ status: 'completed', receipt: { kind: 'mapPinUpdated' } })
    await expect(
      result.current.sessions.map.pins.setVisibility({
        mapId: 'map-1' as Id<'sidebarItems'>,
        mapPinId,
        isVisible: false,
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      receipt: { kind: 'mapPinVisibilityUpdated' },
    })
    await expect(
      result.current.sessions.map.pins.remove({
        mapId: 'map-1' as Id<'sidebarItems'>,
        mapPinId,
      }),
    ).resolves.toMatchObject({ status: 'completed', receipt: { kind: 'mapPinRemoved' } })

    expect(createResult).toEqual({
      status: 'completed',
      receipt: {
        kind: 'mapPinsCreated',
        itemId: 'map-1',
        affectedCount: 1,
        pinIds: [mapPinId],
      },
    })
    expect(campaignMutationMocks.mutateAsync).toHaveBeenCalledWith({
      mapId: 'map-1',
      pins: [{ itemId: 'note-1', x: 12, y: 34 }],
    })
    expect(campaignMutationMocks.mutateAsync).toHaveBeenCalledWith({
      mapPinId,
      x: 56,
      y: 78,
    })
    expect(campaignMutationMocks.mutateAsync).toHaveBeenCalledWith({
      mapPinId,
      visible: false,
    })
    expect(campaignMutationMocks.mutateAsync).toHaveBeenCalledWith({ mapPinId })
  })

  it('opens items separately through the supplied live navigation capability', async () => {
    const { result } = renderLiveWorkspaceRuntime()

    await result.current.navigation.openItem(
      createWizardEditorResource('note-1' as Id<'sidebarItems'>),
      {
        heading: 'Intro#Details',
        target: 'separate',
      },
    )

    expect(navigationMocks.setLastSelectedItem).toHaveBeenCalledWith(liveSourceState.item!.slug)
    expect(navigationMocks.openSeparateItem).toHaveBeenCalledExactlyOnceWith({
      heading: 'Intro#Details',
      itemSlug: liveSourceState.item!.slug,
    })
  })

  it('opens external urls through the supplied live navigation capability', () => {
    const { result } = renderLiveWorkspaceRuntime()

    result.current.navigation.openExternalUrl('https://example.com/handout')

    expect(navigationMocks.openExternalUrl).toHaveBeenCalledExactlyOnceWith(
      'https://example.com/handout',
    )
  })

  it('hydrates body search results through the live filesystem search capability', async () => {
    liveSourceState.extraActiveItems = [createContentNote('note-2', 'Hidden Archive')]
    textImportMocks.convexQuery.mockResolvedValueOnce([
      {
        noteId: 'note-2',
        plainText: 'session clue',
      },
    ])
    const { result } = renderLiveWorkspaceRuntime()
    const search = result.current.search.items
    if (search.status !== 'available') {
      throw new Error('Expected available search capability')
    }

    act(() => {
      search.ensureSearchState({ query: '  session  ' })
    })

    expect(search.getSearchState({ query: '  session  ' })).toMatchObject({
      bodySearchPending: true,
    })
    await waitFor(() =>
      expect(
        getAvailableSearch(result.current).getSearchState({ query: '  session  ' }),
      ).toMatchObject({
        bodySearchPending: false,
        results: [
          expect.objectContaining({
            itemId: 'note-2',
            matchText: 'session clue',
            matchType: 'body',
          }),
        ],
      }),
    )
    expect(textImportMocks.convexQuery.mock.calls[0]?.[1]).toEqual({
      campaignId: 'campaign-1',
      query: 'session',
    })
  })

  it('keeps the latest live filesystem search hydration when reads resolve out of order', async () => {
    liveSourceState.extraActiveItems = [
      createContentNote('note-2', 'Archive Two'),
      createContentNote('note-3', 'Archive Three'),
    ]
    const slowSearch = createDeferred<Array<{ noteId: string; plainText: string }>>()
    const fastSearch = createDeferred<Array<{ noteId: string; plainText: string }>>()
    textImportMocks.convexQuery
      .mockReturnValueOnce(slowSearch.promise)
      .mockReturnValueOnce(fastSearch.promise)
    const { result } = renderLiveWorkspaceRuntime()

    act(() => {
      getAvailableSearch(result.current).ensureSearchState({ query: 'turtle' })
    })
    act(() => {
      getAvailableSearch(result.current).ensureSearchState({ query: 'rabbit' })
    })

    fastSearch.resolve([{ noteId: 'note-3', plainText: 'rabbit clue' }])
    await act(async () => {
      await fastSearch.promise
    })
    slowSearch.resolve([{ noteId: 'note-2', plainText: 'turtle clue' }])
    await act(async () => {
      await slowSearch.promise
    })

    await waitFor(() =>
      expect(getAvailableSearch(result.current).getSearchState({ query: 'rabbit' })).toMatchObject({
        bodySearchPending: false,
        results: [
          expect.objectContaining({
            itemId: 'note-3',
            matchText: 'rabbit clue',
            matchType: 'body',
          }),
        ],
      }),
    )
  })

  it('retries live filesystem search hydration after a transient failure', async () => {
    liveSourceState.extraActiveItems = [createContentNote('note-2', 'Hidden Archive')]
    textImportMocks.convexQuery
      .mockRejectedValueOnce(new Error('temporary search failure'))
      .mockResolvedValueOnce([{ noteId: 'note-2', plainText: 'recovered clue' }])
    const { result } = renderLiveWorkspaceRuntime()

    act(() => {
      getAvailableSearch(result.current).ensureSearchState({ query: 'recover' })
    })

    await waitFor(() =>
      expect(getAvailableSearch(result.current).getSearchState({ query: 'recover' })).toMatchObject(
        {
          bodySearchError: expect.any(Error),
          bodySearchPending: false,
        },
      ),
    )

    act(() => {
      getAvailableSearch(result.current).ensureSearchState({ query: 'recover' })
    })

    await waitFor(() =>
      expect(getAvailableSearch(result.current).getSearchState({ query: 'recover' })).toMatchObject(
        {
          bodySearchError: null,
          bodySearchPending: false,
          results: [
            expect.objectContaining({
              itemId: 'note-2',
              matchText: 'recovered clue',
              matchType: 'body',
            }),
          ],
        },
      ),
    )
    expect(textImportMocks.convexQuery).toHaveBeenCalledTimes(2)
  })

  it('invalidates successful body searches when current note content changes', async () => {
    liveSourceState.extraActiveItems = [createContentNote('note-2', 'Archive Two')]
    textImportMocks.convexQuery
      .mockResolvedValueOnce([{ noteId: 'note-2', plainText: 'old clue' }])
      .mockResolvedValueOnce([{ noteId: 'note-2', plainText: 'updated clue' }])
    const { rerender, result } = renderLiveWorkspaceRuntime()

    act(() => {
      getAvailableSearch(result.current).ensureSearchState({ query: 'clue' })
    })
    await waitFor(() =>
      expect(getAvailableSearch(result.current).getSearchState({ query: 'clue' })).toMatchObject({
        results: [expect.objectContaining({ matchText: 'old clue' })],
      }),
    )

    liveSourceState.contentItem = {
      ...liveSourceState.contentItem!,
      content: [createNoteBlock('changed-content')],
    } as LiveRuntimeNoteItemWithContent
    rerender()
    act(() => {
      getAvailableSearch(result.current).ensureSearchState({ query: 'clue' })
    })

    await waitFor(() =>
      expect(getAvailableSearch(result.current).getSearchState({ query: 'clue' })).toMatchObject({
        results: [expect.objectContaining({ matchText: 'updated clue' })],
      }),
    )
    expect(textImportMocks.convexQuery).toHaveBeenCalledTimes(2)
  })

  it('hydrates live filesystem search per workspace source identity', async () => {
    liveSourceState.extraActiveItems = [createContentNote('note-2', 'Archive Two')]
    textImportMocks.convexQuery
      .mockResolvedValueOnce([{ noteId: 'note-2', plainText: 'first campaign clue' }])
      .mockResolvedValueOnce([{ noteId: 'note-2', plainText: 'second campaign clue' }])
    const { rerender, result } = renderLiveWorkspaceRuntime()

    act(() => {
      getAvailableSearch(result.current).ensureSearchState({ query: 'source' })
    })
    await waitFor(() =>
      expect(getAvailableSearch(result.current).getSearchState({ query: 'source' })).toMatchObject({
        results: [expect.objectContaining({ matchText: 'first campaign clue' })],
      }),
    )

    campaignState.campaignId = 'campaign-2' as Id<'campaigns'>
    rerender()
    act(() => {
      getAvailableSearch(result.current).ensureSearchState({ query: 'source' })
    })

    await waitFor(() =>
      expect(getAvailableSearch(result.current).getSearchState({ query: 'source' })).toMatchObject({
        results: [expect.objectContaining({ matchText: 'second campaign clue' })],
      }),
    )
    expect(textImportMocks.convexQuery).toHaveBeenCalledTimes(2)
  })

  it('hydrates live filesystem search as the selected view-as player', async () => {
    liveSourceState.extraActiveItems = [createContentNote('note-2', 'Player Note')]
    workspaceModeState.campaignActor = {
      kind: 'dm_view_as',
      campaignId: 'campaign-1' as DmViewAsActor['campaignId'],
      memberId: 'member-1' as DmViewAsActor['memberId'],
    }
    textImportMocks.convexQuery.mockResolvedValueOnce([
      { noteId: 'note-2', plainText: 'visible player clue' },
    ])
    const { result } = renderLiveWorkspaceRuntime()

    act(() => {
      getAvailableSearch(result.current).ensureSearchState({ query: 'player clue' })
    })

    await waitFor(() =>
      expect(
        getAvailableSearch(result.current).getSearchState({ query: 'player clue' }),
      ).toMatchObject({
        results: [expect.objectContaining({ matchText: 'visible player clue' })],
      }),
    )
    expect(textImportMocks.convexQuery.mock.calls[0]?.[1]).toEqual({
      campaignId: 'campaign-1',
      campaignMemberId: 'member-1',
      query: 'player clue',
    })
  })

  it('hydrates item content through the live resource content capability', async () => {
    const previewItem = createContentNote('note-2', 'Preview Note')
    liveSourceState.extraActiveItems = [previewItem]
    textImportMocks.convexQuery.mockResolvedValueOnce({ status: 'available', item: previewItem })
    const { result } = renderLiveWorkspaceRuntime()
    const resourceContent = result.current.resources.resourceContent
    if (resourceContent.status !== 'available') {
      throw new Error('Expected available resource content capability')
    }

    act(() => {
      resourceContent.ensureContentState(previewItem.id)
    })

    expect(resourceContent.getContentState(previewItem.id)).toMatchObject({
      isLoading: true,
    })
    await waitFor(() => {
      expect(
        getAvailableResourceContent(result.current).getContentState(previewItem.id),
      ).toMatchObject({
        isLoading: false,
        item: expect.objectContaining({
          id: previewItem.id,
          name: 'Preview Note',
        }),
      })
    })
  })

  it('projects live note content through the selected view-as player visibility', async () => {
    const playerId = 'member-1' as DmViewAsActor['memberId']
    const playerRowId = playerId as unknown as CampaignMemberRowId
    const previewItem = createContentNote('note-2', 'Player Preview', {
      content: [createNoteBlock('visible'), createNoteBlock('hidden')],
      blockMeta: {
        visible: {
          myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
        },
        hidden: {
          myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
          shareStatus: SHARE_STATUS.ALL_SHARED,
          sharedWith: [],
          hiddenFrom: [playerRowId],
        },
      },
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    })
    workspaceModeState.campaignActor = {
      kind: 'dm_view_as',
      campaignId: 'campaign-1' as DmViewAsActor['campaignId'],
      memberId: playerId,
    }
    liveSourceState.extraActiveItems = [previewItem]
    textImportMocks.convexQuery.mockResolvedValueOnce({ status: 'available', item: previewItem })
    const { result } = renderLiveWorkspaceRuntime()

    act(() => {
      getAvailableResourceContent(result.current).ensureContentState(previewItem.id)
    })

    await waitFor(() => {
      expect(
        getAvailableResourceContent(result.current).getContentState(previewItem.id),
      ).toMatchObject({
        isLoading: false,
        item: expect.objectContaining({
          content: [expect.objectContaining({ id: 'visible' })],
        }),
      })
    })
  })

  it('hydrates concurrent live filesystem content per item', async () => {
    const firstPreviewItem = createContentNote('note-2', 'First Preview')
    const secondPreviewItem = createContentNote('note-3', 'Second Preview')
    liveSourceState.extraActiveItems = [firstPreviewItem, secondPreviewItem]
    const slowPreview = createDeferred<{
      status: 'available'
      item: WizardEditorItemWithContent
    }>()
    const fastPreview = createDeferred<{
      status: 'available'
      item: WizardEditorItemWithContent
    }>()
    textImportMocks.convexQuery
      .mockReturnValueOnce(slowPreview.promise)
      .mockReturnValueOnce(fastPreview.promise)
    const { result } = renderLiveWorkspaceRuntime()

    act(() => {
      getAvailableResourceContent(result.current).ensureContentState(firstPreviewItem.id)
    })
    act(() => {
      getAvailableResourceContent(result.current).ensureContentState(secondPreviewItem.id)
    })

    fastPreview.resolve({ status: 'available', item: secondPreviewItem })
    await act(async () => {
      await fastPreview.promise
    })
    slowPreview.resolve({ status: 'available', item: firstPreviewItem })
    await act(async () => {
      await slowPreview.promise
    })

    await waitFor(() => {
      expect(
        getAvailableResourceContent(result.current).getContentState(firstPreviewItem.id),
      ).toMatchObject({
        isLoading: false,
        item: expect.objectContaining({
          id: firstPreviewItem.id,
          name: 'First Preview',
        }),
      })
      expect(
        getAvailableResourceContent(result.current).getContentState(secondPreviewItem.id),
      ).toMatchObject({
        isLoading: false,
        item: expect.objectContaining({
          id: secondPreviewItem.id,
          name: 'Second Preview',
        }),
      })
    })
  })

  it('retries live filesystem content hydration after a transient failure', async () => {
    const previewItem = createContentNote('note-2', 'Recovered Preview')
    liveSourceState.extraActiveItems = [previewItem]
    textImportMocks.convexQuery
      .mockRejectedValueOnce(new Error('temporary preview failure'))
      .mockResolvedValueOnce({ status: 'available', item: previewItem })
    const { result } = renderLiveWorkspaceRuntime()

    act(() => {
      getAvailableResourceContent(result.current).ensureContentState(previewItem.id)
    })

    await waitFor(() =>
      expect(
        getAvailableResourceContent(result.current).getContentState(previewItem.id),
      ).toMatchObject({
        error: expect.any(Error),
        isLoading: false,
        item: undefined,
      }),
    )

    act(() => {
      getAvailableResourceContent(result.current).ensureContentState(previewItem.id)
    })

    await waitFor(() =>
      expect(
        getAvailableResourceContent(result.current).getContentState(previewItem.id),
      ).toMatchObject({
        error: null,
        isLoading: false,
        item: expect.objectContaining({
          id: previewItem.id,
          name: 'Recovered Preview',
        }),
      }),
    )
    expect(textImportMocks.convexQuery).toHaveBeenCalledTimes(2)
  })

  it('reports optimistic live content ids as unavailable without pending hydration', () => {
    const { result } = renderLiveWorkspaceRuntime()
    const resourceContent = getAvailableResourceContent(result.current)
    const optimisticItemId = 'optimistic-create-1' as Parameters<
      typeof resourceContent.ensureContentState
    >[0]

    act(() => {
      resourceContent.ensureContentState(optimisticItemId)
    })

    expect(resourceContent.getContentState(optimisticItemId)).toMatchObject({
      isLoading: false,
      item: undefined,
    })
  })

  it('uses the current live item as the unmounted runtime filesystem selection fallback', () => {
    const { result } = renderLiveWorkspaceRuntime()

    expect(result.current.resources.selection.selectedItemIds).toEqual(['note-1'])
  })

  it('updates item metadata through the filesystem operation capability', async () => {
    const { result } = renderLiveWorkspaceRuntime()

    await result.current.commands.operations.updateItemMetadata({
      item: liveSourceState.item!,
      name: 'Renamed Note',
      iconName: 'FileText',
      color: TEST_METADATA_COLOR,
    })

    expect(fileSystemItemMocks.executeCommand).toHaveBeenCalledWith({
      type: 'rename',
      itemId: liveSourceState.item!.id,
      name: 'Renamed Note',
      iconName: 'FileText',
      color: '#abcdef',
    })
    expect(navigationMocks.setLastSelectedItem).toHaveBeenCalledWith('renamed-note')
    expect(navigationMocks.navigateToItem).toHaveBeenCalledWith('renamed-note', { replace: true })

    await result.current.navigation.openItem(createWizardEditorResource(liveSourceState.item!.id))

    expect(navigationMocks.navigateToItem).toHaveBeenLastCalledWith('renamed-note', undefined)
  })

  it('toggles bookmarks through the filesystem operation capability', async () => {
    const { result } = renderLiveWorkspaceRuntime()

    await result.current.commands.operations.toggleBookmarks([
      'note-1' as Id<'sidebarItems'>,
      'note-2' as Id<'sidebarItems'>,
    ])

    expect(fileSystemItemMocks.executeCommand).toHaveBeenCalledWith({
      type: 'toggleBookmarks',
      itemIds: ['note-1', 'note-2'],
    })
  })

  it('imports media files through the live filesystem operation capability', async () => {
    const createdFileId = 'created-file' as Id<'sidebarItems'>
    liveSourceState.extraActiveItems = [createFolder({ id: 'folder-1' as Id<'sidebarItems'> })]
    const onProgress = vi.fn()
    const file = createImportFile(['image'], 'portrait.png', { type: 'image/png' })
    fileSystemItemMocks.executeCommand.mockImplementationOnce(
      (command: WizardEditorResourceCommand) => {
        if (command.type !== 'create') return createCompletedCommandResult(command)
        return createCompletedCreateCommandResult({
          command,
          itemId: createdFileId,
          slug: 'created-file',
        })
      },
    )
    const { result } = renderLiveWorkspaceRuntime()

    const imported = await result.current.commands.operations.importFile({
      file,
      parentId: 'folder-1' as Id<'sidebarItems'>,
      onProgress,
    })

    expect(mediaImportMocks.createUploadSession.mutateAsync).toHaveBeenCalledWith({})
    expect(mediaImportMocks.uploadFileToUrl).toHaveBeenCalledWith(
      file,
      'https://upload.example',
      expect.objectContaining({
        onProgress: expect.any(Function),
      }),
    )
    const uploadOptions = mediaImportMocks.uploadFileToUrl.mock.calls[0]?.[2]
    uploadOptions?.onProgress?.(42)
    expect(onProgress).toHaveBeenCalledWith({ fileName: 'portrait.png', percentage: 42 })
    expect(fileSystemItemMocks.executeCommand).toHaveBeenCalledWith(
      {
        type: 'create',
        itemType: 'file',
        name: 'portrait.png',
        parentTarget: { kind: 'direct', parentId: 'folder-1' },
      },
      undefined,
    )
    expect(mediaImportMocks.bindUpload.mutateAsync).toHaveBeenCalledWith({
      sessionId: 'upload-session-1',
      storageId: 'storage-2',
      originalFileName: 'portrait.png',
    })
    expect(campaignMutationMocks.mutateAsync).toHaveBeenCalledWith({
      fileId: createdFileId,
      uploadSessionId: 'upload-session-1',
    })
    expect(mediaImportMocks.generatePdfPreviewIfNeeded).toHaveBeenCalledWith(file, createdFileId)
    expect(imported).toEqual({
      status: 'imported',
      kind: 'file',
      fileName: 'portrait.png',
      result: { status: 'completed', id: createdFileId, slug: 'created-file' },
    })
  })

  it('imports text files as notes through the live filesystem operation capability', async () => {
    const createdNoteId = 'created-note' as Id<'sidebarItems'>
    campaignMutationMocks.mutateAsync.mockResolvedValue({ status: 'accepted', seq: 1 })
    liveSourceState.extraActiveItems = [createFolder({ id: 'folder-1' as Id<'sidebarItems'> })]
    const file = createImportFile(['hello'], 'notes.txt', { type: 'text/plain' })
    fileSystemItemMocks.executeCommand.mockImplementationOnce(
      (command: WizardEditorResourceCommand) => {
        if (command.type !== 'create') return createCompletedCommandResult(command)
        return createCompletedCreateCommandResult({
          command,
          itemId: createdNoteId,
          slug: testResourceSlug('created-note'),
        })
      },
    )
    const { result } = renderLiveWorkspaceRuntime()

    const imported = await result.current.commands.operations.importFile({
      file,
      parentId: 'folder-1' as Id<'sidebarItems'>,
    })

    expect(fileSystemItemMocks.executeCommand).toHaveBeenCalledWith(
      {
        type: 'create',
        itemType: 'note',
        name: 'notes.txt',
        parentTarget: { kind: 'direct', parentId: 'folder-1' },
      },
      undefined,
    )
    expect(campaignMutationMocks.mutateAsync).toHaveBeenCalledWith({
      content: [
        expect.objectContaining({
          type: 'paragraph',
          content: [expect.objectContaining({ text: 'hello' })],
        }),
      ],
      documentId: createdNoteId,
      revision: 0,
      update: expect.any(ArrayBuffer),
    })
    expect(imported).toEqual({
      status: 'imported',
      kind: 'note',
      fileName: 'notes.txt',
      result: { status: 'completed', id: createdNoteId, slug: 'created-note' },
    })
  })

  it('exposes the canonical workspace runtime filesystem catalog and current item state', () => {
    const { result } = renderLiveWorkspaceRuntime()
    const itemId = liveSourceState.contentItem!.id

    expect(result.current.resources.catalog.getKnownItemById(itemId)).toEqual(liveSourceState.item)
    expect(result.current.resources.current).toMatchObject({
      item: liveSourceState.item,
      contentItem: liveSourceState.contentItem,
      availabilityState: { status: 'available' },
    })
    expect(result.current.sharing.items).toMatchObject({
      status: 'available',
      renderItemsShareState: expect.any(Function),
      setDefaultPermission: expect.any(Function),
      setParticipantPermission: expect.any(Function),
    })
    expect(result.current.resources.permissions.canCreateItems).toBe(true)
    expect(result.current.resources.permissions.canEmptyTrash).toBe(true)
    expect(result.current.resources.permissions.workspaceMode).toBe(WORKSPACE_MODE.EDITOR)
    expect(result.current.sharing.viewAsParticipant).toMatchObject({
      status: 'available',
      isPending: false,
      participants: [],
      selectedParticipantId: undefined,
    })
    expect(result.current.sessions.canvasPreviewUpload).toEqual({
      status: 'available',
      upload: previewUploadMock,
    })
    expect(
      result.current.resources.permissions.canMutateItem(
        liveSourceState.item!,
        PERMISSION_LEVEL.FULL_ACCESS,
      ),
    ).toBe(true)
  })

  it('clamps stale live view-as member ids after participants load', () => {
    workspaceModeState.campaignActor = {
      kind: 'dm_view_as',
      campaignId: campaignState.campaignId as unknown as DmViewAsActor['campaignId'],
      memberId: 'stale-player' as DmViewAsActor['memberId'],
    }

    const { result } = renderLiveWorkspaceRuntime()

    expect(result.current.sharing.viewAsParticipant).toMatchObject({
      status: 'available',
      isPending: false,
      participants: [],
      selectedParticipantId: undefined,
    })
  })

  it('does not navigate to catalog items outside the visible projection', async () => {
    const hiddenItem = createNote({
      id: 'hidden-note' as Id<'sidebarItems'>,
      name: 'Hidden Note',
      slug: 'hidden-note',
    })
    liveSourceState.hiddenActiveItems = [hiddenItem]
    const { result } = renderLiveWorkspaceRuntime()

    await expect(
      result.current.navigation.openItem(createWizardEditorResource(hiddenItem.id)),
    ).resolves.toEqual({ status: 'unavailable', reason: 'resource_not_visible' })
    expect(navigationMocks.setLastSelectedItem).not.toHaveBeenCalledWith(hiddenItem.slug)
    expect(navigationMocks.navigateToItem).not.toHaveBeenCalledWith(hiddenItem.slug, undefined)
  })

  it('does not hydrate note outgoing links for non-note current items', () => {
    liveSourceState.contentItem = createContentMap('map-1')
    liveSourceState.item = liveSourceState.contentItem

    renderLiveWorkspaceRuntime()

    const queryArgs = campaignQueryMock.mock.calls.map((call) => call[1])
    expect(queryArgs).toContainEqual({ itemId: 'map-1' })
    expect(queryArgs).not.toContainEqual({ noteId: 'map-1' })
  })

  it('keeps optimistic current item link ids out of live link queries', () => {
    liveSourceState.contentItem = createContentNote('optimistic-create-1')
    liveSourceState.item = liveSourceState.contentItem

    const { result } = renderLiveWorkspaceRuntime()
    const search = getAvailableSearch(result.current)
    if (search.itemLinks.status !== 'available') {
      throw new Error('Expected available item links')
    }

    expect(
      search.itemLinks.getItemLinks({
        itemId: 'optimistic-create-1' as Id<'sidebarItems'>,
        kind: 'backlinks',
      }),
    ).toEqual({ status: 'success', links: [] })
    expect(
      search.itemLinks.getItemLinks({
        itemId: 'optimistic-create-1' as Id<'sidebarItems'>,
        kind: 'outgoing',
      }),
    ).toEqual({ status: 'success', links: [] })
    expect(campaignQueryMock.mock.calls.map((call) => call[1])).not.toContainEqual({
      itemId: 'optimistic-create-1',
    })
    expect(campaignQueryMock.mock.calls.map((call) => call[1])).not.toContainEqual({
      noteId: 'optimistic-create-1',
    })
  })

  it('wires sidebar sharing through the sidebar share mutation contract', () => {
    const { result } = renderLiveWorkspaceRuntime()
    const sharing = result.current.sharing.items
    if (sharing.status !== 'available') throw new Error('Expected sidebar sharing')

    render(sharing.renderItemsShareState([liveSourceState.item!], () => null))

    expect(sidebarShareMocks.useLiveSidebarItemsShare).toHaveBeenCalledWith(
      [liveSourceState.item],
      {
        setDefaultPermission: fileSystemItemMocks.setDefaultPermission,
        setParticipantPermission: fileSystemItemMocks.setParticipantPermission,
        clearParticipantPermission: fileSystemItemMocks.clearParticipantPermission,
        setFolderInheritShares: fileSystemItemMocks.setFolderInheritShares,
      },
    )
  })

  it('translates non-DM role state into filesystem permission affordances', () => {
    campaignState.isDm = false
    workspaceModeState.campaignActor = {
      kind: 'player',
      campaignId: 'campaign-1' as CampaignActor['campaignId'],
    }

    const { result } = renderLiveWorkspaceRuntime()

    expect(sidebarShareMocks.useLiveSidebarItemsShare).not.toHaveBeenCalled()
    expect(result.current.sharing.items).toEqual({
      status: 'unsupported',
      reason: 'insufficient_authority',
    })
  })
})

function createContentNote(
  id: string,
  name?: string,
  overrides: Partial<LiveRuntimeNoteItemWithContent> = {},
): LiveRuntimeNoteItemWithContent {
  return {
    ...createNote({ id: id as Id<'sidebarItems'>, name }),
    ancestors: [],
    content: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    ...overrides,
  } as LiveRuntimeNoteItemWithContent
}

function createContentMap(id: string): WizardEditorItemWithContent {
  return {
    ...createGameMap({ id: id as Id<'sidebarItems'> }),
    ancestors: [],
    imageUrl: null,
    layers: [],
    pins: [],
  } as WizardEditorItemWithContent
}

function createNoteBlock(id: string): LiveRuntimeNoteBlock {
  return {
    id,
    type: 'paragraph',
    content: [],
  } as unknown as LiveRuntimeNoteBlock
}

function getAvailableSearch(runtime: {
  search: { items: FileSystemSearch }
}): Extract<FileSystemSearch, { status: 'available' }> {
  const search = runtime.search.items
  if (search.status !== 'available') {
    throw new Error('Expected available search capability')
  }
  return search
}

function getAvailableResourceContent(runtime: {
  resources: { resourceContent: FileSystemResourceContent }
}): Extract<FileSystemResourceContent, { status: 'available' }> {
  const resourceContent = runtime.resources.resourceContent
  if (resourceContent.status !== 'available') {
    throw new Error('Expected available resource content capability')
  }
  return resourceContent
}

function testResourceSlug(value: string): WizardEditorResourceSlug {
  const slug = parseWizardEditorResourceSlug(value)
  if (!slug) {
    throw new Error(`Invalid test resource slug: ${value}`)
  }
  return slug
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}
