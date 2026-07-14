import { describe, expect, it, vi } from 'vitest'
import {
  createWizardEditorCatalogNavigation,
  createWizardEditorCommandSource,
  createWizardEditorDocumentSource,
  createWizardEditorFileContentSource,
  createWizardEditorPermissionSource,
  createWizardEditorRemoteDownloadSource,
  createWizardEditorResourceCatalogSource,
  createWizardEditorResource,
  createWizardEditorRuntime,
  createWizardEditorRuntimeSources,
  createWizardEditorSharingSource,
  createWizardEditorCatalogSnapshot,
  createWizardEditorCatalogResourceSource,
  createWizardEditorCatalogIoSource,
  createWizardEditorCatalogSearchSource,
  createWizardEditorUnsupportedHistorySource,
  getWizardEditorNavigationCurrentResourceId,
  getWizardEditorResourceId,
  isWizardEditorItemWithContent,
  resolveWizardEditorMapImage,
  resolveWizardEditorNavigationState,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorAdapter,
  WizardEditorCommandSource,
  WizardEditorDocumentSourceInput,
  WizardEditorItemWithContent,
} from '@wizard-archive/editor/adapter'
import { assertResourceItemSlug } from '@wizard-archive/editor/resources/items'
import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import {
  completedResourceCommand,
  RESOURCE_EVENT_TYPE,
} from '@wizard-archive/editor/resources/transaction-contract'
import type { SidebarItemId } from 'shared/common/ids'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { WORKSPACE_MODE } from 'shared/workspace/workspace-mode'
import type { ResourceImportFile } from '../files/import-contract'
import { createCanvas, createFile, createGameMap, createNote } from '../test/sidebar-item-factory'
import { testMapPinId } from '../../../../shared/test/map-pin-id'
import { testOperationId } from '../../../../shared/test/operation-id'

type AdapterCanvasItemWithContent = Extract<WizardEditorItemWithContent, { type: 'canvas' }>
type AdapterFileItemWithContent = Extract<WizardEditorItemWithContent, { type: 'file' }>
type AdapterNoteItemWithContent = Extract<WizardEditorItemWithContent, { type: 'note' }>

describe('WizardEditor adapter contract', () => {
  it('creates a runtime from one source-neutral adapter object', () => {
    const adapter = createTestAdapter({
      workspace: { id: 'workspace-1' },
    })

    const runtime = createWizardEditorRuntime(adapter)

    expect(runtime.workspace.id).toBe('workspace-1')
    expect(runtime.resources.current).toBe(adapter.resources.current)
    expect(runtime.sharing).toBe(adapter.sharing)
    expect('operations' in adapter.resources).toBe(false)
    expect(runtime.commands.operations).toEqual(expect.any(Object))
    expect(runtime.resources.permissions.canCreateItems).toBe(true)
    expect(runtime.resources.selection.selectedItemIds).toEqual([])
    expect(runtime.navigation.canOpenItemsSeparately).toEqual({ status: 'available' })
    expect(runtime.navigation.current).toBe(adapter.navigation.current)
    expect(runtime.navigation.openItem).toBe(adapter.navigation.openItem)
    expect(runtime.sessions).not.toBe(adapter.documents)
    expect(runtime.sessions.canvas).not.toBe(adapter.documents.canvas)
    expect(runtime.sessions.canvasEmbedded).toBe(adapter.documents.canvasEmbedded)
    expect(runtime.sessions.file).toBe(adapter.documents.file)
  })

  it('preserves every typed document session port through runtime construction', async () => {
    const runtime = createWizardEditorRuntime(createTestAdapter())
    const canvas = createContentCanvas()
    const file = createContentFile()
    const map = createGameMap()
    const note = createContentNote()
    const importFile = createTestImportFile()
    const mapPinId = testMapPinId('map-pin-1')

    expect(runtime.sessions.canvas.document.useCanvasDocumentSession(canvas)).toEqual({
      status: 'loading',
    })
    expect(
      runtime.sessions.canvasEmbedded.embeddedCanvas.useEmbeddedCanvasState(canvas.id),
    ).toEqual({ status: 'loading' })
    expect(runtime.sessions.canvasPreviewUpload).toEqual({ status: 'unsupported' })
    expect(runtime.sessions.file.resolveFile(file)).toMatchObject({ status: 'unattached' })
    await expect(
      runtime.sessions.file.replaceFile({ fileId: file.id, file: importFile }),
    ).resolves.toMatchObject({ status: 'unsupported' })
    await expect(
      runtime.sessions.map.updateMapImage({ mapId: map.id, file: importFile }),
    ).resolves.toMatchObject({ status: 'unsupported' })
    await expect(
      runtime.sessions.map.pins.create({ mapId: map.id, pins: [] }),
    ).resolves.toMatchObject({ status: 'unsupported' })
    await expect(
      runtime.sessions.map.pins.update({ mapId: map.id, mapPinId, x: 1, y: 2 }),
    ).resolves.toMatchObject({ status: 'unsupported' })
    await expect(
      runtime.sessions.map.pins.setVisibility({ mapId: map.id, mapPinId, isVisible: false }),
    ).resolves.toMatchObject({ status: 'unsupported' })
    await expect(
      runtime.sessions.map.pins.remove({ mapId: map.id, mapPinId }),
    ).resolves.toMatchObject({ status: 'unsupported' })
    expect(
      runtime.sessions.note.document.useCollaborationSession({ mode: 'readonly', note }),
    ).toMatchObject({ status: 'unavailable', mode: 'readonly' })
    expect(runtime.sessions.noteHeadings.headings.useNoteHeadings(note.id)).toEqual({
      headings: [],
      status: 'success',
    })
    expect(
      runtime.sessions.notePlayback.playback.getCollaborationPlayback?.(note.id),
    ).toBeUndefined()
    expect(runtime.sessions.noteValues.values.useNoteValueStates([note.id])).toEqual({
      states: [],
      status: 'success',
    })
  })

  it('keeps resource identity helpers on the adapter contract', () => {
    const resource = createWizardEditorResource('item-1' as never)

    expect(getWizardEditorResourceId(resource)).toBe('item-1')
  })

  it('resolves layered map images through the adapter contract', () => {
    expect(
      resolveWizardEditorMapImage(
        {
          imageAssetId: null,
          imageUrl: 'base-map.png',
          layers: [
            {
              id: 'layer-1',
              imageAssetId: null,
              imageUrl: 'gm-layer.png',
              name: 'GM',
            },
            {
              id: 'layer-2',
              imageAssetId: null,
              imageUrl: 'player-layer.png',
              name: 'Player',
            },
          ],
        },
        'layer-2',
      ),
    ).toMatchObject({ imageUrl: 'player-layer.png', layer: { id: 'layer-2' } })
  })

  it('resolves navigation state from resource facts without adapter-specific callbacks', () => {
    const resource = createWizardEditorResource('item-1' as never)

    expect(
      resolveWizardEditorNavigationState({
        canCreateDashboard: true,
        isResourceRequested: true,
        isWorkspaceLoaded: true,
        resource: resource,
        trashRequested: false,
      }),
    ).toEqual({ kind: 'resource', resource })
    expect(
      getWizardEditorNavigationCurrentResourceId({
        current: { kind: 'resource', resource },
      }),
    ).toBe('item-1')
  })

  it('builds catalog navigation from adapter navigation callbacks and catalog facts', () => {
    const visible = createContentNote({
      id: 'visible-note' as SidebarItemId,
      name: 'Visible Note',
      slug: 'visible-note',
    })
    const trashed = createContentNote({
      id: 'trashed-note' as SidebarItemId,
      name: 'Trashed Note',
      slug: 'trashed-note',
      status: RESOURCE_STATUS.trashed,
    })
    const hidden = createContentNote({
      id: 'hidden-note' as SidebarItemId,
      name: 'Hidden Note',
      slug: 'hidden-note',
    })
    const snapshot = createWizardEditorCatalogSnapshot({
      activeItems: [visible, hidden],
      trashItems: [trashed],
      visibleActiveItems: [visible],
      current: { kind: 'empty' },
      unavailableResource: {
        label: 'Test item',
        message: 'Select an item.',
      },
    })
    const setNavigation = vi.fn()
    const openExternalUrl = vi.fn()
    const openSeparateItem = vi.fn()
    const navigation = createWizardEditorCatalogNavigation({
      catalog: snapshot.catalog,
      current: { kind: 'empty' },
      openExternalUrl,
      openSeparateItem,
      setNavigation,
    })

    navigation.openDefaultItem()
    expect(setNavigation).toHaveBeenCalledWith({
      kind: 'resource',
      resource: createWizardEditorResource(visible.id),
    })

    navigation.openItem(createWizardEditorResource(visible.id), {
      heading: 'Visible Note',
      target: 'separate',
    })
    expect(openSeparateItem).toHaveBeenCalledWith({
      heading: 'Visible Note',
      itemId: String(visible.id),
    })
    expect(navigation.openItem(createWizardEditorResource(hidden.id))).toEqual({
      status: 'unavailable',
      reason: 'resource_not_visible',
    })
    expect(
      navigation.openItem(createWizardEditorResource(hidden.id), { target: 'separate' }),
    ).toEqual({
      status: 'unavailable',
      reason: 'resource_not_visible',
    })

    navigation.openExternalUrl('https://example.test')
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.test')

    setNavigation.mockClear()
    const staleCurrentNavigation = createWizardEditorCatalogNavigation({
      catalog: snapshot.catalog,
      current: { kind: 'resource', resource: createWizardEditorResource(trashed.id) },
      openExternalUrl,
      openSeparateItem,
      setNavigation,
    })

    staleCurrentNavigation.openDefaultItem()
    expect(setNavigation).toHaveBeenCalledExactlyOnceWith({
      kind: 'resource',
      resource: createWizardEditorResource(visible.id),
    })
  })

  it('returns an explicit navigation capability when separate opens are unsupported', () => {
    const snapshot = createWizardEditorCatalogSnapshot({
      activeItems: [],
      trashItems: [],
      current: { kind: 'empty' },
      unavailableResource: {
        label: 'Test item',
        message: 'Select an item.',
      },
    })
    const navigation = createWizardEditorCatalogNavigation({
      catalog: snapshot.catalog,
      current: { kind: 'empty' },
      openExternalUrl: vi.fn(),
      separateNavigationUnavailableReason: 'demo_single_surface',
      setNavigation: vi.fn(),
    })

    expect(navigation.canOpenItemsSeparately).toEqual({
      status: 'unsupported',
      reason: 'demo_single_surface',
    })
    expect(
      navigation.openItem(createWizardEditorResource('missing-item' as SidebarItemId), {
        target: 'separate',
      }),
    ).toEqual({
      status: 'unavailable',
      reason: 'demo_single_surface',
    })
  })

  it('expresses unsupported behavior as capability state inside sources', () => {
    const adapter = createTestAdapter({
      sharing: {
        blocks: { status: 'unsupported', reason: 'not_available' },
        items: { status: 'unsupported', reason: 'not_available' },
        viewAsParticipant: { status: 'unsupported', reason: 'not_available' },
      },
    })

    expect(createWizardEditorRuntime(adapter).sharing.viewAsParticipant).toEqual({
      status: 'unsupported',
      reason: 'not_available',
    })
  })

  it('builds sharing sources from capability facts and normalizes local player selection', () => {
    const setSelectedParticipantId = vi.fn()
    type viewAsParticipantInput = NonNullable<
      Parameters<typeof createWizardEditorSharingSource>[0]['viewAsParticipant']
    >
    const participants = [
      { id: 'player-1', displayName: 'Player One' },
    ] as viewAsParticipantInput['participants']

    const sharing = createWizardEditorSharingSource({
      unavailableReason: 'not_available',
      viewAsParticipant: {
        canUse: true,
        isPending: false,
        participants,
        selectedParticipantId: 'missing-player' as viewAsParticipantInput['selectedParticipantId'],
        setSelectedParticipantId,
      },
    })

    expect(sharing.blocks).toEqual({ status: 'unsupported', reason: 'not_available' })
    expect(sharing.items).toEqual({ status: 'unsupported', reason: 'not_available' })
    expect(sharing.viewAsParticipant).toMatchObject({
      status: 'available',
      isPending: false,
      participants,
      selectedParticipantId: undefined,
    })
    if (sharing.viewAsParticipant.status !== 'available') {
      throw new Error('Expected view-as-participant capability')
    }

    sharing.viewAsParticipant.setSelectedParticipantId(
      'player-1' as viewAsParticipantInput['selectedParticipantId'],
    )
    sharing.viewAsParticipant.setSelectedParticipantId(
      'missing-player' as viewAsParticipantInput['selectedParticipantId'],
    )

    expect(setSelectedParticipantId).toHaveBeenNthCalledWith(1, 'player-1')
    expect(setSelectedParticipantId).toHaveBeenNthCalledWith(2, undefined)
  })

  it('builds command sources from adapter command drivers and capability facts', () => {
    const clipboardDriver = createTestCommands().clipboardDriver
    const contentInitializers = createTestCommands().contentInitializers
    const resourceCommandDriver = createTestCommands().resourceCommandDriver
    const trashDriver = createTestCommands().trashDriver
    const navigateToItem = vi.fn()
    const reportCreateItemError = vi.fn()

    const commands = createWizardEditorCommandSource({
      canCreateItems: true,
      canManageFolders: false,
      clipboardDriver,
      contentInitializers,
      navigateToItem,
      resourceCommandDriver,
      reportCreateItemError,
      trashDialogDriver: trashDriver,
      unavailableReason: 'read_only',
    })

    expect(commands.capabilities).toEqual({
      createItems: { status: 'available' },
      manageFolders: { status: 'unsupported', reason: 'read_only' },
    })
    expect(commands.clipboardDriver).toBe(clipboardDriver)
    expect(commands.contentInitializers).toBe(contentInitializers)
    expect(commands.resourceCommandDriver).toBe(resourceCommandDriver)
    expect(commands.navigateToItem).toBe(navigateToItem)
    expect(commands.reportCreateItemError).toBe(reportCreateItemError)
    commands.dropDriver.executeDropCommand({ type: 'trash', itemIds: [] })
    commands.operationDriver.toggleBookmarks([])
    commands.historyDriver.undo()
    expect(resourceCommandDriver.executeCommand).toHaveBeenCalledTimes(2)
    expect(resourceCommandDriver.undo).toHaveBeenCalledOnce()
    expect(commands.trashDriver.confirmDeleteForever).toBe(trashDriver.confirmDeleteForever)
    expect(commands.trashDriver.confirmEmptyTrash).toBe(trashDriver.confirmEmptyTrash)
  })

  it('builds permission sources from workspace authority facts', () => {
    const setWorkspaceMode = vi.fn()
    const permissions = createWizardEditorPermissionSource({
      actor: null,
      canEdit: false,
      canUseWorkspaceActions: true,
      canManageFolders: false,
      getItemById: () => null,
      setWorkspaceMode,
      workspaceMode: WORKSPACE_MODE.VIEWER,
    })

    expect(permissions).toMatchObject({
      actor: null,
      canCreateItems: true,
      canEdit: false,
      canEmptyTrash: true,
      canManageFolders: false,
      workspaceMode: WORKSPACE_MODE.VIEWER,
    })

    permissions.setWorkspaceMode(WORKSPACE_MODE.EDITOR)
    expect(setWorkspaceMode).not.toHaveBeenCalled()
  })

  it('exposes item mutation checks from the package-owned permission source', () => {
    const editableFile = createContentFile({
      id: 'editable-file' as SidebarItemId,
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
    })
    const permissions = createWizardEditorPermissionSource({
      actor: { kind: 'participant' },
      canEdit: true,
      canUseWorkspaceActions: false,
      getItemById: (itemId) => (itemId === editableFile.id ? editableFile : null),
      setWorkspaceMode: vi.fn(),
      workspaceMode: WORKSPACE_MODE.EDITOR,
    })

    expect(permissions.canMutateItem(editableFile, PERMISSION_LEVEL.EDIT)).toBe(true)
    expect(permissions.canMutateItem(editableFile, PERMISSION_LEVEL.FULL_ACCESS)).toBe(false)
  })

  it('builds file content sessions, import receipts, and download urls from adapter facts', async () => {
    const fileItem = createContentFile({
      id: 'file-handout' as never,
      name: 'Handout',
    })
    const writeFile = vi.fn(() => Promise.resolve())
    const source = createWizardEditorFileContentSource({
      canReplaceFile: () => true,
      getItemById: (itemId) => (itemId === fileItem.id ? fileItem : null),
      resolveFile: (file) => ({
        allowObjectUrl: false,
        contentType: file.contentType,
        downloadUrl: `download:${file.id}`,
        name: file.name,
        size: 12,
        status: 'available',
      }),
      writeFile,
    })
    const importFile = createImportFile('imported.txt')

    expect(source.session.resolveFile(fileItem)).toMatchObject({
      downloadUrl: 'download:file-handout',
      name: 'Handout',
    })
    expect(source.resolveFileDownloadUrl(fileItem)).toBe('download:file-handout')

    await expect(
      source.initializeImportedFile({ file: importFile, fileId: fileItem.id }),
    ).resolves.toEqual({
      status: 'completed',
      receipt: { kind: 'fileImported', itemId: fileItem.id, affectedCount: 1 },
    })
    await expect(
      source.session.replaceFile({ file: importFile, fileId: fileItem.id }),
    ).resolves.toEqual({
      status: 'completed',
      receipt: { kind: 'fileReplaced', itemId: fileItem.id, affectedCount: 1 },
    })
    await expect(
      source.session.replaceFile({ file: importFile, fileId: 'missing-file' as never }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'file_not_found' })
    expect(writeFile).toHaveBeenCalledTimes(2)

    const readOnlySource = createWizardEditorFileContentSource({
      canReplaceFile: () => false,
      getItemById: () => fileItem,
      readOnlyErrorMessage: 'read only',
      resolveFile: source.session.resolveFile,
      writeFile,
    })

    await expect(
      readOnlySource.session.replaceFile({ file: importFile, fileId: fileItem.id }),
    ).resolves.toMatchObject({ status: 'error', error: { message: 'read only' } })

    const writeError = new Error('write failed')
    const failingSource = createWizardEditorFileContentSource({
      canReplaceFile: () => true,
      getItemById: () => fileItem,
      resolveFile: source.session.resolveFile,
      writeFile: vi.fn(() => Promise.reject(writeError)),
    })

    await expect(
      failingSource.session.replaceFile({ file: importFile, fileId: fileItem.id }),
    ).resolves.toEqual({ status: 'error', error: writeError })
  })

  it('keeps catalog resources separate from explicit root domains', () => {
    const resources = createTestResources()
    const runtime = createWizardEditorRuntime(createTestAdapter({ resources }))

    expect('search' in resources).toBe(false)
    expect('history' in resources).toBe(false)
    expect('download' in resources).toBe(false)
    expect('sharing' in resources).toBe(false)
    expect(runtime.resources.load.activeStatus).toBe('success')
    expect(runtime.resources.resourceContent.status).toBe('unsupported')
    expect(runtime.search.items.status).toBe('unsupported')
    expect('resourcePreview' in runtime.search).toBe(false)
    expect(runtime.io.download.status).toBe('unsupported')
    expect(runtime.history).toEqual({
      status: 'unsupported',
      reason: 'not_implemented',
    })
  })

  it('builds a catalog-backed runtime through the shared adapter source path', () => {
    const visible = createContentNote({ name: 'Visible Note', slug: 'visible-note' })
    const snapshot = createWizardEditorCatalogSnapshot({
      activeItems: [visible],
      trashItems: [],
      visibleActiveItems: [visible],
      current: { kind: 'empty' },
      unavailableResource: {
        label: 'Test item',
        message: 'Select an item.',
      },
    })
    const commandDrivers = createTestCommands()
    const setNavigation = vi.fn()
    const resources = createWizardEditorCatalogResourceSource({
      snapshot,
      permissions: createTestPermissionSource(),
    })
    const runtimeSources = createWizardEditorRuntimeSources({
      commands: {
        canCreateItems: true,
        clipboardDriver: commandDrivers.clipboardDriver,
        contentInitializers: commandDrivers.contentInitializers,
        navigateToItem: commandDrivers.navigateToItem,
        resourceCommandDriver: commandDrivers.resourceCommandDriver,
        reportCreateItemError: commandDrivers.reportCreateItemError,
        trashDialogDriver: commandDrivers.trashDriver,
        unavailableReason: 'read_only',
      },
      io: createWizardEditorCatalogIoSource(resources, {
        file: createTestDocuments().file,
        resolveCanvasDownloadContent: vi.fn(() => ({ edges: [], nodes: [] })),
        resolveMapDownloadUrl: vi.fn(() => null),
      }),
      search: createWizardEditorCatalogSearchSource(resources),
      history: createWizardEditorUnsupportedHistorySource('not_implemented'),
      sharing: createWizardEditorSharingSource({ unavailableReason: 'not_available' }),
      resources,
      documents: createTestDocuments(),
    })
    const runtime = createWizardEditorRuntime({
      workspace: { id: 'workspace-1', instanceId: 'runtime-1' },
      navigation: createWizardEditorCatalogNavigation({
        catalog: resources.catalog,
        current: { kind: 'empty' },
        openExternalUrl: vi.fn(),
        setNavigation,
      }),
      ...runtimeSources,
    })

    expect(runtime.workspace).toEqual({ id: 'workspace-1', instanceId: 'runtime-1' })
    expect(runtime.resources.current).toBe(snapshot.current)
    expect(runtime.resources.load.activeStatus).toBe('success')
    expect(runtime.resources.resourceContent.status).toBe('available')
    if (runtime.resources.resourceContent.status !== 'available') {
      throw new Error('Expected available resource content capability')
    }
    expect(runtime.resources.resourceContent.getContentState(visible.id)).toMatchObject({
      status: 'ready',
      item: expect.objectContaining({ id: visible.id }),
    })
    expect(runtime.search.items.status).toBe('available')
    expect('resourcePreview' in runtime.search).toBe(false)
    expect(runtime.commands.operations).toEqual(expect.any(Object))

    runtime.navigation.openDefaultItem()
    expect(setNavigation).toHaveBeenCalledWith({
      kind: 'resource',
      resource: createWizardEditorResource(visible.id),
    })
  })

  it('builds catalog runtime sources from local adapter facts', async () => {
    const fileItem = createContentFile({
      id: 'file-handout' as never,
      name: 'Handout',
    })
    const snapshot = createWizardEditorCatalogSnapshot({
      activeItems: [fileItem],
      trashItems: [],
      visibleActiveItems: [fileItem],
      current: { kind: 'resource', resource: createWizardEditorResource(fileItem.id) },
      unavailableResource: {
        label: 'Test item',
        message: 'Select an item.',
      },
    })
    const commandDrivers = createTestCommands()
    const writeFile = vi.fn(() => Promise.resolve())
    const initializeImportedTextFile = vi.fn()

    const resources = createWizardEditorCatalogResourceSource({
      snapshot,
      permissions: {
        actor: null,
        canEdit: true,
        canUseWorkspaceActions: true,
        setWorkspaceMode: vi.fn(),
        workspaceMode: WORKSPACE_MODE.EDITOR,
      },
    })
    const fileDocument = {
      canReplaceFile: () => true,
      getItemById: (itemId: string) => snapshot.catalog.getKnownItemById(itemId as SidebarItemId),
      resolveFile: (file: AdapterFileItemWithContent) => ({
        allowObjectUrl: false,
        contentType: file.contentType,
        downloadUrl: `download:${file.id}`,
        name: file.name,
        size: 12,
        status: 'available' as const,
      }),
      writeFile,
    }
    const sources = createWizardEditorRuntimeSources({
      commands: {
        canCreateItems: true,
        clipboardDriver: commandDrivers.clipboardDriver,
        contentInitializers: {
          initializeImportedTextFile,
        },
        navigateToItem: commandDrivers.navigateToItem,
        resourceCommandDriver: commandDrivers.resourceCommandDriver,
        reportCreateItemError: commandDrivers.reportCreateItemError,
        trashDialogDriver: commandDrivers.trashDriver,
        unavailableReason: 'read_only',
      },
      documents: {
        ...createTestDocuments(),
        file: fileDocument,
      },
      io: createWizardEditorCatalogIoSource(resources, {
        file: fileDocument,
        resolveCanvasDownloadContent: vi.fn(() => ({ edges: [], nodes: [] })),
        resolveMapDownloadUrl: vi.fn(() => null),
      }),
      search: createWizardEditorCatalogSearchSource(resources),
      history: createWizardEditorUnsupportedHistorySource('not_implemented'),
      sharing: {
        unavailableReason: 'not_available',
      },
      resources,
    })

    expect(sources.commands.contentInitializers.initializeImportedTextFile).toBe(
      initializeImportedTextFile,
    )
    expect(sources.resources.permissions).toMatchObject({ canEdit: true })
    expect(sources.sharing.viewAsParticipant).toEqual({
      status: 'unsupported',
      reason: 'not_available',
    })
    expect(sources.documents.file.resolveFile(fileItem).downloadUrl).toBe('download:file-handout')

    const importFile = createImportFile('replacement.txt')
    await sources.commands.contentInitializers.initializeImportedFile({
      file: importFile,
      fileId: fileItem.id,
    })
    expect(writeFile).toHaveBeenCalledWith({
      file: importFile,
      fileId: fileItem.id,
      onProgress: undefined,
    })
  })

  it('builds runtime sources from one adapter-facing input object', () => {
    const commandDrivers = createTestCommands()
    const resources = createTestResources()
    const documents = createTestDocuments()

    const sources = createWizardEditorRuntimeSources({
      commands: {
        canCreateItems: true,
        clipboardDriver: commandDrivers.clipboardDriver,
        contentInitializers: commandDrivers.contentInitializers,
        navigateToItem: commandDrivers.navigateToItem,
        resourceCommandDriver: commandDrivers.resourceCommandDriver,
        reportCreateItemError: commandDrivers.reportCreateItemError,
        trashDialogDriver: commandDrivers.trashDriver,
        unavailableReason: 'not_dm',
      },
      search: createTestSearchSource(),
      io: createTestIoSource(),
      history: { status: 'unsupported', reason: 'not_implemented' },
      sharing: createTestSharingSource(),
      resources,
      documents,
    })

    expect(sources.commands.capabilities.createItems).toEqual({ status: 'available' })
    expect(sources.resources).toEqual(resources)
    expect(sources.documents).toEqual(documents)
  })

  it('wraps remote download loaders inside the editor runtime boundary', async () => {
    const runtime = createWizardEditorRuntime(
      createTestAdapter({
        io: createTestRemoteDownloadIo(),
      }),
    )

    expect(runtime.io.download.status).toBe('available')
    if (runtime.io.download.status !== 'available') {
      throw new Error('Expected available download capability')
    }
    await expect(runtime.io.download.loadRootItemsForDownload()).resolves.toEqual({
      status: 'completed',
      receipt: { kind: 'downloadPrepared', affectedCount: 0 },
      items: [],
      skippedItems: [],
    })
  })

  it('builds remote download sources from loader facts', async () => {
    const loadItemsForDownload = vi.fn(() => Promise.resolve({ items: [] }))
    const loadRootItemsForDownload = vi.fn(() => Promise.resolve({ items: [] }))
    const download = createWizardEditorRemoteDownloadSource({
      canDownloadRoot: false,
      loadItemsForDownload,
      loadRootItemsForDownload,
      unavailableRootReason: 'not_dm',
    })

    expect(download.kind).toBe('remoteItems')
    await expect(download.loadItemsForDownload({ itemIds: ['note-1' as never] })).resolves.toEqual({
      items: [],
    })
    await expect(download.loadRootItemsForDownload()).resolves.toEqual({
      status: 'unsupported',
      reason: 'not_dm',
      items: [],
    })
    expect(loadItemsForDownload).toHaveBeenCalledExactlyOnceWith({ itemIds: ['note-1'] })
    expect(loadRootItemsForDownload).not.toHaveBeenCalled()
  })

  it('builds resource catalog and load sources from adapter read-model facts', () => {
    const visible = createContentNote({ name: 'Visible Note', slug: 'visible-note' })
    const hidden = createContentNote({ name: 'Hidden Note', slug: 'hidden-note' })
    const trashed = createContentNote({
      name: 'Trashed Note',
      slug: 'trashed-note',
      status: RESOURCE_STATUS.trashed,
    })

    expect(isWizardEditorItemWithContent(visible)).toBe(true)
    const refreshActive = vi.fn(() => Promise.resolve())
    const refreshTrash = vi.fn(() => Promise.resolve())

    const source = createWizardEditorResourceCatalogSource({
      activeItems: [visible, hidden],
      activeStatus: 'success',
      activeError: null,
      refreshActive,
      trashItems: [trashed],
      trashStatus: 'error',
      trashError: new Error('trash failed'),
      refreshTrash,
      visibleActiveItems: [visible],
    })

    expect(source.catalog.getKnownItemById(hidden.id)?.id).toBe(hidden.id)
    expect(source.catalog.getVisibleItemById(hidden.id)).toBeNull()
    expect(source.catalog.getVisibleItemById(visible.id)?.id).toBe(visible.id)
    expect(source.catalog.getTrashedItems().map((item) => item.id)).toEqual([trashed.id])
    expect(
      source.operationItems.resolveItems({ itemIds: [hidden.id] }).map((item) => item.id),
    ).toEqual([hidden.id])
    expect(source.load).toMatchObject({
      activeStatus: 'success',
      activeError: null,
      trashStatus: 'error',
      trashError: expect.any(Error),
    })
    expect(source.load.refreshActive).toBe(refreshActive)
    expect(source.load.refreshTrash).toBe(refreshTrash)
  })

  it('builds static catalog snapshots from adapter read-model facts', () => {
    const visible = createContentNote({ name: 'Visible Note', slug: 'visible-note' })
    const hidden = createContentNote({ name: 'Hidden Note', slug: 'hidden-note' })
    const trashed = createContentNote({
      name: 'Trashed Note',
      slug: 'trashed-note',
      status: RESOURCE_STATUS.trashed,
    })

    expect(isWizardEditorItemWithContent(visible)).toBe(true)

    const visibleSnapshot = createWizardEditorCatalogSnapshot({
      activeItems: [visible, hidden],
      trashItems: [trashed],
      visibleActiveItems: [visible],
      current: { kind: 'resource', resource: createWizardEditorResource(visible.id) },
      unavailableResource: {
        label: 'Test item',
        message: 'Select an item.',
      },
    })

    expect(visibleSnapshot.current.contentItem?.id).toBe(visible.id)
    expect(visibleSnapshot.current.availabilityState).toMatchObject({
      status: 'available',
      label: visible.name,
      item: visible,
    })
    expect(visibleSnapshot.operationItems.resolveItems({ itemIds: [hidden.id] })).toEqual([hidden])

    const hiddenSnapshot = createWizardEditorCatalogSnapshot({
      activeItems: [visible, hidden],
      trashItems: [trashed],
      visibleActiveItems: [visible],
      current: { kind: 'resource', resource: createWizardEditorResource(hidden.id) },
      unavailableResource: {
        label: 'Test item',
        message: 'Select an item.',
      },
    })

    expect(hiddenSnapshot.current.contentItem).toBeNull()
    expect(hiddenSnapshot.current.availabilityState).toEqual({
      status: 'not_shared',
      label: 'Hidden Note',
      message: "This item isn't shared with you.",
    })

    const trashedSnapshot = createWizardEditorCatalogSnapshot({
      activeItems: [visible],
      trashItems: [trashed],
      current: { kind: 'resource', resource: createWizardEditorResource(trashed.id) },
      unavailableResource: {
        label: 'Test item',
        message: 'Select an item.',
      },
    })

    expect(trashedSnapshot.current.contentItem?.id).toBe(trashed.id)
    expect(trashedSnapshot.current.availabilityState).toMatchObject({
      status: 'trashed',
      label: trashed.name,
    })
  })

  it('builds catalog resource sources from adapter-owned catalog snapshots', () => {
    const visible = createContentNote({ name: 'Visible Note', slug: 'visible-note' })
    const snapshot = createWizardEditorCatalogSnapshot({
      activeItems: [visible],
      trashItems: [],
      visibleActiveItems: [visible],
      current: { kind: 'resource', resource: createWizardEditorResource(visible.id) },
      unavailableResource: {
        label: 'Test item',
        message: 'Select an item.',
      },
    })
    const permissions = createTestPermissionSource()
    const source = createWizardEditorCatalogResourceSource({
      permissions,
      snapshot,
    })

    expect(source.catalog).toBe(snapshot.catalog)
    expect(source.current).toBe(snapshot.current)
    expect(source.load.activeStatus).toBe('success')
    expect(source.operationItems).toBe(snapshot.operationItems)
    expect(source.paths).toBe(snapshot.paths)
    expect(source.permissions).toBe(permissions)
    expect(source.resourceContent.status).toBe('available')
    if (source.resourceContent.status !== 'available') {
      throw new Error('Expected available resource content capability')
    }
    expect(source.resourceContent.getContentState(visible.id)).toMatchObject({
      status: 'ready',
      item: expect.objectContaining({ id: visible.id }),
    })
  })
})

function createTestAdapter(overrides: Partial<WizardEditorAdapter> = {}): WizardEditorAdapter {
  return {
    workspace: { id: 'workspace-1' },
    commands: createTestCommands(),
    resources: createTestResources(),
    search: createTestSearchSource(),
    io: createTestIoSource(),
    history: { status: 'unsupported', reason: 'not_implemented' },
    sharing: createTestSharingSource(),
    navigation: {
      canOpenItemsSeparately: { status: 'available' },
      current: { kind: 'create' },
      openCreateDashboard: vi.fn(),
      openDefaultItem: vi.fn(),
      openExternalUrl: vi.fn(),
      openItem: vi.fn(),
      openTrash: vi.fn(),
    },
    documents: createTestDocuments(),
    ...overrides,
  } as unknown as WizardEditorAdapter
}

function createTestDocuments(): WizardEditorAdapter['documents'] {
  const input = {
    canvas: {
      document: {
        useCanvasDocumentSession: vi.fn(() => ({ status: 'loading' as const })),
      },
    },
    canvasEmbedded: {
      embeddedCanvas: {
        useEmbeddedCanvasState: vi.fn(() => ({ status: 'loading' as const })),
      },
    },
    canvasPreviewUpload: { status: 'unsupported' },
    file: {
      replaceFile: vi.fn(() => Promise.resolve(unsupportedTestOperation())),
      resolveFile: vi.fn((file) => ({
        allowObjectUrl: false as const,
        contentType: file.contentType,
        downloadUrl: null,
        name: file.name,
        size: null,
        status: 'unattached' as const,
      })),
    },
    map: {
      pins: {
        create: vi.fn(() => Promise.resolve(unsupportedTestOperation())),
        remove: vi.fn(() => Promise.resolve(unsupportedTestOperation())),
        setVisibility: vi.fn(() => Promise.resolve(unsupportedTestOperation())),
        update: vi.fn(() => Promise.resolve(unsupportedTestOperation())),
      },
      updateMapImage: vi.fn(() => Promise.resolve(unsupportedTestOperation())),
    },
    note: {
      document: {
        useCollaborationSession: vi.fn(({ mode }) => ({
          instanceId: 'test-note-session',
          mode,
          reason: 'missing_collaboration_engine' as const,
          status: 'unavailable' as const,
          user: { color: '#000000', name: 'Test user' },
        })),
      },
    },
    noteHeadings: {
      headings: {
        useNoteHeadings: vi.fn(() => ({ headings: [], status: 'success' as const })),
      },
    },
    notePlayback: {
      playback: {
        getCollaborationPlayback: vi.fn(() => undefined),
      },
    },
    noteValues: {
      values: {
        useNoteValueStates: vi.fn(() => ({ states: [], status: 'success' as const })),
      },
    },
  } satisfies WizardEditorDocumentSourceInput

  return createWizardEditorDocumentSource(input)
}

function unsupportedTestOperation() {
  return { status: 'unsupported', reason: 'test_fixture' } as const
}

function createTestImportFile(): ResourceImportFile {
  return {
    name: 'test.txt',
    contentType: 'text/plain',
    size: 4,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
    text: () => Promise.resolve('test'),
  }
}

function createTestCommands(): WizardEditorCommandSource {
  return createWizardEditorCommandSource({
    canCreateItems: true,
    canManageFolders: true,
    clipboardDriver: {
      canPaste: vi.fn(() => false),
      canUseClipboardOperations: false,
      cancelClipboard: vi.fn(() => false),
      copy: vi.fn(),
      cut: vi.fn(),
      paste: vi.fn(),
    },
    contentInitializers: {
      initializeImportedFile: vi.fn(),
      initializeImportedTextFile: vi.fn(),
    },
    ioCapabilities: {},
    resourceCommandDriver: createTestResourceCommandDriver(),
    trashDialogDriver: {
      confirmDeleteForever: vi.fn(),
      confirmEmptyTrash: vi.fn(),
    },
    unavailableReason: 'read_only',
    navigateToItem: vi.fn(),
    reportCreateItemError: vi.fn(),
  })
}

function createTestResourceCommandDriver(): WizardEditorCommandSource['resourceCommandDriver'] {
  return {
    executeCommand: vi.fn((command) => {
      if (command.type === 'create') {
        return completedResourceCommand(
          command,
          [
            {
              type: RESOURCE_EVENT_TYPE.created,
              itemId: 'created-item' as SidebarItemId,
              slug: assertResourceItemSlug('created-item'),
            },
          ],
          { transactionId: testOperationId('transaction-created-item') },
        )
      }
      if (command.type === 'rename') {
        return completedResourceCommand(command, [
          {
            type: RESOURCE_EVENT_TYPE.renamed,
            itemId: command.itemId,
            slug: assertResourceItemSlug('renamed-item'),
            previousSlug: assertResourceItemSlug('old-item'),
          },
        ])
      }
      return completedResourceCommand(command, [])
    }),
    discardCreatedItem: vi.fn(),
    undo: vi.fn(() => ({ status: 'unavailable', reason: 'history_unsupported' }) as const),
    redo: vi.fn(() => ({ status: 'unavailable', reason: 'history_unsupported' }) as const),
    canUndo: false,
    canRedo: false,
  }
}

function createTestResources(): WizardEditorAdapter['resources'] {
  return {
    catalog: {
      getKnownItemById: vi.fn(() => null),
      getVisibleChildren: vi.fn(() => []),
      getVisibleRoots: vi.fn(() => []),
      queryVisibleItems: vi.fn(() => []),
    },
    current: {
      item: null,
      contentItem: null,
      availabilityState: { status: 'empty', label: 'Workspace' },
    },
    load: {
      activeError: null,
      activeStatus: 'success',
      refreshActive: vi.fn(),
      refreshTrash: vi.fn(),
      trashError: null,
      trashStatus: 'success',
    },
    operationItems: {
      resolveItems: vi.fn(() => []),
    },
    paths: {},
    permissions: createTestPermissionSource(),
    resourceContent: { status: 'unsupported', reason: 'not_implemented' },
  } as unknown as WizardEditorAdapter['resources']
}

function createTestPermissionSource(): WizardEditorAdapter['resources']['permissions'] {
  return {
    actor: null,
    canCreateItems: true,
    canEdit: true,
    canEmptyTrash: true,
    canManageFolders: true,
    canAccessItem: () => true,
    canMutateItem: () => true,
    getMemberItemPermissionLevel: () => PERMISSION_LEVEL.FULL_ACCESS,
    setWorkspaceMode: vi.fn(),
    workspaceMode: WORKSPACE_MODE.EDITOR,
  }
}

function createTestSearchSource(): WizardEditorAdapter['search'] {
  return {
    items: { status: 'unsupported', reason: 'not_implemented' },
  }
}

function createTestIoSource(): WizardEditorAdapter['io'] {
  return {
    download: { status: 'unsupported', reason: 'not_available' },
  }
}

function createTestSharingSource(): WizardEditorAdapter['sharing'] {
  return {
    blocks: { status: 'unsupported', reason: 'not_available' },
    items: { status: 'unsupported', reason: 'not_available' },
    viewAsParticipant: { status: 'unsupported', reason: 'not_available' },
  }
}

function createTestRemoteDownloadIo(): WizardEditorAdapter['io'] {
  return {
    download: {
      kind: 'remoteItems',
      loadItemsForDownload: vi.fn(() => Promise.resolve({ items: [] })),
      loadRootItemsForDownload: vi.fn(() => Promise.resolve({ items: [] })),
    },
  } as unknown as WizardEditorAdapter['io']
}

function createContentNote(
  overrides?: Parameters<typeof createNote>[0],
): AdapterNoteItemWithContent {
  const note = {
    ...createNote(overrides),
    ancestors: [],
    shares: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    content: [],
  } satisfies AdapterNoteItemWithContent

  return note
}

function createContentCanvas(
  overrides?: Parameters<typeof createCanvas>[0],
): AdapterCanvasItemWithContent {
  return {
    ...createCanvas(overrides),
    ancestors: [],
    shares: [],
  }
}

function createContentFile(
  overrides?: Parameters<typeof createFile>[0],
): AdapterFileItemWithContent {
  return {
    ...createFile(overrides),
    ancestors: [],
    shares: [],
  }
}

function createImportFile(name: string) {
  return {
    name,
    contentType: 'text/plain',
    size: 4,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
    text: () => Promise.resolve('text'),
  }
}
