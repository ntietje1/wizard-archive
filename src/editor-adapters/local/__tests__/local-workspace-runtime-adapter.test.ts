import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vite-plus/test'
import { WORKSPACE_MODE } from 'shared/workspace/workspace-mode'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { SHARE_STATUS } from 'shared/block-shares/share-status'
import { LOCAL_WORKSPACE_INITIAL_TIMESTAMP, localWorkspaceReducer } from '../local-workspace-model'
import type { LocalWorkspaceState } from '../local-workspace-model'
import {
  createPublicDemoScenario,
  PUBLIC_DEMO_SCENARIO_IDS,
} from '../public-demo-workspace-presets'
import { SAMPLE_LOCAL_WORKSPACE } from '../sample-local-workspace'
import { createLocalWorkspaceRuntime as createLocalWorkspaceRuntimeBase } from '../local-workspace-runtime-adapter'
import { testNoteBlockId } from 'shared/test/note-block-id'
import {
  createLocalFileSystemSnapshot,
  createLocalWorkspaceInitialNavigation,
} from '../local-filesystem-snapshot'
import {
  createTestCanvasEmbeddedSessionPorts,
  createTestCanvasSessionPorts,
  createTestNoteHeadingSessionPorts,
  createTestNotePlaybackSessionPorts,
  createTestNoteSessionPorts,
  createTestNoteValueSessionPorts,
} from './helpers/session-sources'
import type { CampaignMemberId, SidebarItemId } from 'shared/common/ids'
import {
  completeWizardEditorResourceCommand,
  createWizardEditorResource,
  getWizardEditorNavigationCurrentResourceId,
  WIZARD_EDITOR_RESOURCE_COMMAND_TYPE,
  WIZARD_EDITOR_RESOURCE_EVENT_TYPE,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorFileSessionReplaceInput,
  WizardEditorItem,
  WizardEditorItemWithContent,
  WizardEditorNavigationState,
  WizardEditorRuntime,
} from '@wizard-archive/editor/adapter'
import { createImportFile } from './helpers/import-file'

const TEST_RESOURCE_TYPES = {
  canvases: 'canvas',
  files: 'file',
  folders: 'folder',
  gameMaps: 'gameMap',
  notes: 'note',
} as const satisfies Record<string, WizardEditorItem['type']>
const TEST_PARENT_TARGET_KIND = {
  direct: 'direct',
  path: 'path',
} as const

type LocalFileItemWithContent = Extract<WizardEditorItemWithContent, { type: 'file' }>
type LocalMapItemWithContent = Extract<WizardEditorItemWithContent, { type: 'gameMap' }>
type LocalNoteItemWithContent = Extract<WizardEditorItemWithContent, { type: 'note' }>
type LocalNoteBlock = LocalNoteItemWithContent['content'][number]
type LocalImportFile = WizardEditorFileSessionReplaceInput['file']

describe('createLocalRuntimeFileSystem', () => {
  it('keeps sharing command classification out of the local executor', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-filesystem-operations.ts'),
      'utf8',
    )

    expect(source).toContain('isWizardEditorResourceSharingCommand(command)')
    expect(source).not.toContain(
      'case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.setResourceAudiencePermission',
    )
    expect(source).not.toContain(
      'case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.setResourcesMemberPermission',
    )
    expect(source).not.toContain(
      'case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission',
    )
    expect(source).not.toContain('case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.setFolderInheritShares')
    expect(source).not.toContain('case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.setBlocksShareStatus')
    expect(source).not.toContain(
      'case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.setBlockMemberPermission',
    )
  })

  it('keeps catalog command classification out of local receipt planning', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-filesystem-command-receipts.ts'),
      'utf8',
    )

    expect(source).toContain('WizardEditorResourceCatalogCommand')
    expect(source).not.toContain('export type LocalExecutableFileSystemCommand')
    expect(source).not.toContain('Extract<WizardEditorResourceCommand')
  })

  it('keeps create parent command options typed by the package contract', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-filesystem-operations.ts'),
      'utf8',
    )

    expect(source).toContain('WizardEditorResourceCreateParentPlan')
    expect(source).toContain('WizardEditorResourceCommandExecutionOptions')
    expect(source).not.toContain('type LocalCreateParentPlan')
    expect(source).not.toContain('createParentPlan?: unknown')
    expect(source).not.toContain('as LocalCreateParentPlan')
  })

  it('keeps local command branch types owned by the package contract', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-filesystem-operations.ts'),
      'utf8',
    )

    expect(source).toContain('WizardEditorResourceCreateCommand')
    expect(source).toContain('WizardEditorResourceRenameCommand')
    expect(source).not.toContain('Extract<WizardEditorResourceCommand')
  })

  it('applies committed local catalog commands from package command receipts', () => {
    const operationsSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-filesystem-operations.ts'),
      'utf8',
    )
    const modelSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-workspace-model.ts'),
      'utf8',
    )

    expect(operationsSource).toContain("type: 'applyResourceCommandReceipt'")
    expect(operationsSource).not.toContain('case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.move')
    expect(operationsSource).not.toContain('case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.copy')
    expect(operationsSource).not.toContain('case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.trash')
    expect(operationsSource).not.toContain('case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.restore')
    expect(operationsSource).not.toContain('case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.deleteForever')
    expect(operationsSource).not.toContain('case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.emptyTrash')
    expect(operationsSource).not.toContain(
      'case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.toggleBookmarks',
    )
    expect(modelSource).toContain('applyResourceCommandReceipt')
  })

  it('adapts demo seed state into the workspace filesystem contract', () => {
    const workspace = SAMPLE_LOCAL_WORKSPACE
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })
    const contentItem = filesystem.catalog.getKnownItemById('note-market' as SidebarItemId)

    expect(contentItem).toMatchObject({ id: 'note-market' })
    expect(filesystem.current.contentItem).toBe(contentItem)
    expect(filesystem.permissions.canMutateItem(contentItem!, PERMISSION_LEVEL.FULL_ACCESS)).toBe(
      true,
    )

    const created = filesystem.operations.createItem({
      type: TEST_RESOURCE_TYPES.notes,
      parentTarget: { kind: TEST_PARENT_TARGET_KIND.direct, parentId: null },
      name: 'Local note',
    })

    expect(created).toEqual({ status: 'completed', id: 'local-note-2', slug: 'local-note-2' })
    expectCreateItemDispatch(dispatch, { id: 'local-note-2', parentId: null, type: 'note' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-note-2',
      title: 'Local note',
    })
  })

  it('adapts seeded map content into the filesystem cache', () => {
    const filesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      navigation: {
        kind: 'resource',
        resource: createWizardEditorResource('map-docks' as SidebarItemId),
      },
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const map = filesystem.current.contentItem

    expect(map).toMatchObject({
      id: 'map-docks',
      imageUrl: expect.stringContaining('data:image/svg+xml'),
      pins: [
        expect.objectContaining({ id: 'local-map-pin-1', itemId: 'note-market' }),
        expect.objectContaining({ id: 'local-map-pin-2', itemId: 'file-handout' }),
      ],
      type: TEST_RESOURCE_TYPES.gameMaps,
    })
    expect(
      SAMPLE_LOCAL_WORKSPACE.mapsById['map-docks']?.pins.map((pin) => pin.creationTime),
    ).toEqual([1704067200000, 1704067200000])
  })

  it('updates local item metadata through the workspace filesystem operation', async () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const item = filesystem.catalog.getKnownItemById('note-market' as SidebarItemId)

    const update = await filesystem.operations.updateItemMetadata({
      item: item!,
      name: 'Renamed Market',
      iconName: 'FileText',
      color: testResourceColor('#ABCDEF'),
    })

    expect(update).toEqual({ slug: 'renamed-market' })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const nextFilesystem = nextRuntime.resources

    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'note-market',
      slug: 'renamed-market',
      title: 'Renamed Market',
      iconName: 'FileText',
      color: '#abcdef',
    })
    expect(nextFilesystem.catalog.getKnownItemById('note-market' as SidebarItemId)).toMatchObject({
      name: 'Renamed Market',
      slug: 'renamed-market',
      iconName: 'FileText',
      color: '#abcdef',
    })
  })

  it('toggles local bookmarks through the workspace filesystem operation', async () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    await filesystem.operations.toggleBookmarks(['note-market' as SidebarItemId])

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const nextFilesystem = nextRuntime.resources

    expect(dispatch).toHaveBeenCalledWith({
      type: 'applyResourceCommandReceipt',
      receipt: expect.objectContaining({
        command: {
          type: 'toggleBookmarks',
          itemIds: ['note-market'],
        },
      }),
    })
    expect(nextFilesystem.catalog.getKnownItemById('note-market' as SidebarItemId)).toMatchObject({
      isBookmarked: true,
    })
  })

  it('replaces local file content through the workspace file session source', async () => {
    const dispatch = vi.fn()
    const runtime = createLocalRuntime({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    await expect(
      runtime.sessions.file.replaceFile({
        fileId: 'file-handout' as SidebarItemId,
        file: createImportFile(['updated handout'], 'updated.txt', { type: 'text/plain' }),
      }),
    ).resolves.toEqual({
      status: 'completed',
      receipt: {
        kind: 'fileReplaced',
        itemId: 'file-handout',
        affectedCount: 1,
      },
    })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const nextFilesystem = nextRuntime.resources
    const file = nextFilesystem.catalog.getKnownItemById(
      'file-handout' as SidebarItemId,
    ) as LocalFileItemWithContent

    expect(dispatch).toHaveBeenCalledWith({
      type: 'replaceFile',
      itemId: 'file-handout',
      payload: expect.objectContaining({
        allowDataUrl: true,
        allowObjectUrl: false,
        contentType: 'text/plain',
        name: 'updated.txt',
        size: 15,
      }),
    })
    expect(nextRuntime.sessions.file.resolveFile(file)).toMatchObject({
      allowDataUrl: true,
      contentType: 'text/plain',
      downloadUrl: expect.stringContaining('data:text/plain'),
      name: 'updated.txt',
      size: 15,
    })
  })

  it('preserves local file data urls that span multiple binary chunks', async () => {
    const bytes = Array.from({ length: 0x8001 }, (_, index) => index % 256)
    const dispatch = vi.fn()
    const runtime = createLocalRuntime({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    await runtime.sessions.file.replaceFile({
      fileId: 'file-handout' as SidebarItemId,
      file: createLocalImportFile({
        bytes,
        contentType: 'image/png',
        name: 'chunked.png',
      }),
    })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const file = nextRuntime.resources.catalog.getKnownItemById(
      'file-handout' as SidebarItemId,
    ) as LocalFileItemWithContent

    expect(nextRuntime.sessions.file.resolveFile(file)).toMatchObject({
      allowDataUrl: true,
      allowObjectUrl: false,
      contentType: 'image/png',
      downloadUrl: `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`,
      name: 'chunked.png',
      size: bytes.length,
    })
  })

  it('rejects oversized local file replacements before reading them into memory', async () => {
    const arrayBuffer = vi.fn(() => new ArrayBuffer(0))
    const dispatch = vi.fn()
    const runtime = createLocalRuntime({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const result = await runtime.sessions.file.replaceFile({
      fileId: 'file-handout' as SidebarItemId,
      file: createLocalImportFile({
        arrayBuffer,
        contentType: 'image/png',
        name: 'too-large.png',
        size: Number.MAX_SAFE_INTEGER,
      }),
    })

    expect(result).toMatchObject({
      status: 'error',
      error: expect.objectContaining({
        message: 'File must be less than 10MB',
      }),
    })
    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('imports local media files through the workspace filesystem operation', async () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const created = await filesystem.operations.importFile({
      file: createImportFile(['image'], 'portrait.png', { type: 'image/png' }),
      parentId: null,
    })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const nextFilesystem = nextRuntime.resources
    const file = nextFilesystem.catalog.getKnownItemById(
      'local-file-2' as SidebarItemId,
    ) as LocalFileItemWithContent

    expect(created).toEqual({
      status: 'imported',
      kind: 'file',
      fileName: 'portrait.png',
      result: { status: 'completed', id: 'local-file-2', slug: 'local-file-2' },
    })
    expectCreateItemDispatch(dispatch, { id: 'local-file-2', parentId: null, type: 'file' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-file-2',
      title: 'portrait.png',
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'replaceFile',
      itemId: 'local-file-2',
      payload: expect.objectContaining({
        allowDataUrl: true,
        allowObjectUrl: false,
        contentType: 'image/png',
        name: 'portrait.png',
        size: 5,
      }),
    })
    expect(nextRuntime.sessions.file.resolveFile(file)).toMatchObject({
      allowDataUrl: true,
      contentType: 'image/png',
      downloadUrl: expect.stringContaining('data:image/png'),
      name: 'portrait.png',
      size: 5,
    })
  })

  it('rejects oversized local file imports before creating an item or reading the file', async () => {
    const arrayBuffer = vi.fn(() => new ArrayBuffer(0))
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const created = await filesystem.operations.importFile({
      file: createLocalImportFile({
        arrayBuffer,
        name: 'too-large.png',
        size: 11 * 1024 * 1024,
        contentType: 'image/png',
      }),
      parentId: null,
    })

    expect(created).toEqual({
      status: 'skipped',
      fileName: 'too-large.png',
      reason: 'invalid',
      error: 'File must be less than 10MB',
    })
    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('imports local text files as notes through the workspace filesystem operation', async () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const created = await filesystem.operations.importFile({
      file: createImportFile(['first line\n- second'], 'notes.txt', { type: 'text/plain' }),
      parentId: null,
    })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const nextFilesystem = nextRuntime.resources
    const note = nextFilesystem.catalog.getKnownItemById(
      'local-note-2' as SidebarItemId,
    ) as LocalNoteItemWithContent

    expect(created).toEqual({
      status: 'imported',
      kind: 'note',
      fileName: 'notes.txt',
      result: { status: 'completed', id: 'local-note-2', slug: 'local-note-2' },
    })
    expectCreateItemDispatch(dispatch, { id: 'local-note-2', parentId: null, type: 'note' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-note-2',
      title: 'notes.txt',
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'replaceNoteBody',
      itemId: 'local-note-2',
      body: 'first line\n- second',
    })
    expect(note.content).toEqual([
      expect.objectContaining({
        type: 'paragraph',
        content: [expect.objectContaining({ text: 'first line' })],
      }),
      expect.objectContaining({
        type: 'paragraph',
        content: [expect.objectContaining({ text: '- second' })],
      }),
    ])
  })

  it('imports a single local file through the workspace filesystem import operation', async () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const imported = await filesystem.operations.importFile({
      file: createImportFile(['local note'], 'notes.txt', { type: 'text/plain' }),
      parentId: null,
    })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const nextFilesystem = nextRuntime.resources
    const note = nextFilesystem.catalog.getKnownItemById(
      'local-note-2' as SidebarItemId,
    ) as LocalNoteItemWithContent

    expect(imported).toEqual({
      status: 'imported',
      kind: 'note',
      fileName: 'notes.txt',
      result: { status: 'completed', id: 'local-note-2', slug: 'local-note-2' },
    })
    expect(note.content).toEqual([
      expect.objectContaining({
        type: 'paragraph',
        content: [expect.objectContaining({ text: 'local note' })],
      }),
    ])
  })

  it('rolls back a local text import when note initialization fails', async () => {
    const dispatch = vi.fn()
    const failure = new Error('text import failed')
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const file = createImportFile(['local note'], 'notes.txt', { type: 'text/plain' })
    vi.spyOn(file, 'text').mockRejectedValue(failure)

    await expect(
      filesystem.operations.importFile({
        file,
        parentId: null,
      }),
    ).resolves.toEqual({
      status: 'skipped',
      fileName: 'notes.txt',
      reason: 'failed',
      error: failure,
    })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'trashItems',
      itemIds: ['local-note-2'],
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'deleteItemsForever',
      itemIds: ['local-note-2'],
    })
    expect(nextWorkspace.noteBodiesById).not.toHaveProperty('local-note-2')
    expect(nextRuntime.resources.catalog.getKnownItemById('local-note-2' as SidebarItemId)).toBe(
      null,
    )
  })

  it('imports local file drop trees through the workspace filesystem operation', async () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const rootText = createImportFile(['root note'], 'notes.txt', { type: 'text/plain' })
    const folderImage = createImportFile(['image'], 'portrait.png', { type: 'image/png' })

    const receipt = await filesystem.operations.importDrop({
      files: [{ file: rootText }],
      rootFolders: [
        {
          name: 'Assets',
          files: [{ file: folderImage }],
          subfolders: [],
        },
      ],
      parentId: null,
    })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const nextFilesystem = nextRuntime.resources
    const note = nextFilesystem.catalog.getKnownItemById(
      'local-note-2' as SidebarItemId,
    ) as LocalNoteItemWithContent
    const folder = nextFilesystem.catalog.getKnownItemById('local-folder-3' as SidebarItemId)
    const file = nextFilesystem.catalog.getKnownItemById(
      'local-file-4' as SidebarItemId,
    ) as LocalFileItemWithContent

    expect(receipt).toEqual({
      processedFiles: 2,
      processedFolders: 1,
      skippedFiles: 0,
      lastFolderId: 'local-folder-3',
      skippedFileDetails: [],
    })
    expect(note).toMatchObject({
      id: 'local-note-2',
      name: 'notes.txt',
      parentId: null,
      type: TEST_RESOURCE_TYPES.notes,
    })
    expect(folder).toMatchObject({
      id: 'local-folder-3',
      name: 'Assets',
      parentId: null,
      type: TEST_RESOURCE_TYPES.folders,
    })
    expect(file).toMatchObject({
      id: 'local-file-4',
      name: 'portrait.png',
      parentId: 'local-folder-3',
      type: TEST_RESOURCE_TYPES.files,
    })
    expect(nextRuntime.sessions.file.resolveFile(file)).toMatchObject({
      allowDataUrl: true,
      contentType: 'image/png',
      downloadUrl: expect.stringContaining('data:image/png'),
      name: 'portrait.png',
      size: 5,
    })
    expect(note.content).toEqual([
      expect.objectContaining({
        type: 'paragraph',
        content: [expect.objectContaining({ text: 'root note' })],
      }),
    ])
  })

  it('mutates local map pins and images through the map session source', async () => {
    const dispatch = vi.fn()
    const runtime = createLocalRuntime({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const createResult = await runtime.sessions.map.pins.create({
      mapId: 'map-docks' as SidebarItemId,
      pins: [{ itemId: 'canvas-heist' as SidebarItemId, x: 40, y: 60 }],
    })
    if (createResult.status !== 'completed') throw new Error('Expected map pin creation')
    const createdPinIds = createResult.receipt.pinIds
    await runtime.sessions.map.pins.update({
      mapId: 'map-docks' as SidebarItemId,
      mapPinId: createdPinIds[0]!,
      x: 41,
      y: 61,
    })
    await runtime.sessions.map.pins.setVisibility({
      mapId: 'map-docks' as SidebarItemId,
      mapPinId: createdPinIds[0]!,
      isVisible: false,
    })
    await expect(
      runtime.sessions.map.updateMapImage({
        mapId: 'map-docks' as SidebarItemId,
        file: createImportFile(['<svg />'], 'local-map.svg', { type: 'image/svg+xml' }),
      }),
    ).resolves.toMatchObject({ status: 'completed', receipt: { kind: 'mapImageUpdated' } })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextDispatch = vi.fn()
    const nextRuntime = createLocalRuntime({
      dispatch: nextDispatch,
      workspace: nextWorkspace,
    })
    const nextFilesystem = nextRuntime.resources
    const nextMap = nextFilesystem.catalog.getKnownItemById(
      'map-docks' as SidebarItemId,
    ) as LocalMapItemWithContent

    expect(createdPinIds).toEqual(['local-map-pin-3'])
    expect(nextMap.imageUrl).toContain('data:image/svg+xml')
    expect(nextMap.pins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'local-map-pin-3',
          itemId: 'canvas-heist',
          x: 41,
          y: 61,
          visible: false,
        }),
      ]),
    )

    await nextRuntime.sessions.map.pins.remove({
      mapId: 'map-docks' as SidebarItemId,
      mapPinId: createdPinIds[0]!,
    })
    const finalWorkspace = nextDispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      nextWorkspace,
    )
    const finalFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: finalWorkspace,
    })
    const finalMap = finalFilesystem.catalog.getKnownItemById(
      'map-docks' as SidebarItemId,
    ) as LocalMapItemWithContent

    expect(finalMap.pins.map((pin) => pin.id)).toEqual(['local-map-pin-1', 'local-map-pin-2'])
  })

  it('does not report duplicate map pins from a stale local runtime snapshot', async () => {
    const dispatch = vi.fn()
    const runtime = createLocalRuntime({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const firstCreateResult = await runtime.sessions.map.pins.create({
      mapId: 'map-docks' as SidebarItemId,
      pins: [{ itemId: 'canvas-heist' as SidebarItemId, x: 40, y: 60 }],
    })
    if (firstCreateResult.status !== 'completed') throw new Error('Expected map pin creation')
    const duplicateCreateResult = await runtime.sessions.map.pins.create({
      mapId: 'map-docks' as SidebarItemId,
      pins: [{ itemId: 'canvas-heist' as SidebarItemId, x: 44, y: 64 }],
    })
    if (duplicateCreateResult.status !== 'completed') {
      throw new Error('Expected duplicate map pin operation to complete')
    }

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextMap = nextWorkspace.mapsById['map-docks']

    expect(firstCreateResult.receipt.pinIds).toEqual(['local-map-pin-3'])
    expect(duplicateCreateResult.receipt.pinIds).toEqual([])
    expect(nextWorkspace.nextLocalMapPinIndex).toBe(4)
    expect(nextMap?.pins.filter((pin) => pin.itemId === 'canvas-heist')).toEqual([
      expect.objectContaining({
        id: 'local-map-pin-3',
        x: 40,
        y: 60,
      }),
    ])
  })

  it('keeps owner block metadata while read-only mode gates local mutations', () => {
    const filesystem = createLocalRuntimeFileSystem({
      canEdit: false,
      dispatch: vi.fn(),
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const note = filesystem.catalog.getKnownItemById('note-market' as SidebarItemId)

    expect(note).toMatchObject({ type: TEST_RESOURCE_TYPES.notes })
    if (!note || note.type !== TEST_RESOURCE_TYPES.notes) {
      throw new Error('Expected seeded note')
    }
    const noteWithContent = note as LocalNoteItemWithContent

    expect(noteWithContent.content.length).toBeGreaterThan(0)
    expect(Object.keys(noteWithContent.blockMeta)).toEqual(
      noteWithContent.content.map((block) => block.id),
    )
    expect(Object.values(noteWithContent.blockMeta)).toEqual(
      noteWithContent.content.map(() =>
        expect.objectContaining({
          myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
          sharedWith: [],
        }),
      ),
    )
    expect(filesystem.permissions.canMutateItem(noteWithContent, PERMISSION_LEVEL.VIEW)).toBe(false)
  })

  it('projects selected-player visible item permissions into local map pins', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)
    const filesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: scenario.workspace,
    })
    const map = filesystem.catalog.getKnownItemById('map-docks' as SidebarItemId)

    expect(map).toMatchObject({
      type: TEST_RESOURCE_TYPES.gameMaps,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    if (!map || map.type !== TEST_RESOURCE_TYPES.gameMaps) {
      throw new Error('Expected layered lore map')
    }

    const mapWithContent = map as LocalMapItemWithContent
    expect(mapWithContent.layers).toEqual([
      expect.objectContaining({ id: 'map-docks-layer-1', name: 'Layer 1' }),
      expect.objectContaining({ id: 'map-docks-layer-2', name: 'Layer 2' }),
    ])
    expect(findMapPin(mapWithContent, 'file-tunnel-sketch')).toMatchObject({
      layerId: 'map-docks-layer-2',
    })
    expect(findMapPinItem(mapWithContent, 'file-tunnel-sketch')).toMatchObject({
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    expect(findMapPin(mapWithContent, 'file-handout')).toMatchObject({
      layerId: 'map-docks-layer-1',
    })
    expect(findMapPinItem(mapWithContent, 'file-handout')).toMatchObject({
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    expect(mapWithContent.pins.map((pin) => pin.itemId)).toEqual(
      expect.arrayContaining(['file-tunnel-sketch', 'file-handout', 'canvas-heist']),
    )
    expect(mapWithContent.pins).toHaveLength(3)
    expect(findMapPin(mapWithContent, 'canvas-heist')).toMatchObject({
      visible: false,
    })
  })

  it('does not synthesize selected-player access for unshared local items', () => {
    const selectedParticipantId = 'demo-member-unshared' as CampaignMemberId
    const filesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: {
        ...SAMPLE_LOCAL_WORKSPACE,
        selectedViewAsPlayerId: selectedParticipantId,
      },
    })
    const note = filesystem.catalog.getKnownItemById('note-market' as SidebarItemId)

    expect(note).toMatchObject({
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })
    expect(filesystem.permissions.canAccessItem(note!, PERMISSION_LEVEL.VIEW)).toBe(false)
    expect(filesystem.permissions.getMemberItemPermissionLevel(note!, selectedParticipantId)).toBe(
      PERMISSION_LEVEL.NONE,
    )
  })

  it('omits hidden ancestors from selected-player visible local items', () => {
    const selectedParticipantId = 'demo-member-mira' as CampaignMemberId
    const folderId = 'folder-gm-only'
    const noteId = 'note-player-clue'
    const filesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      setSelectedViewAsPlayerId: vi.fn(),
      workspace: {
        ...SAMPLE_LOCAL_WORKSPACE,
        selectedViewAsPlayerId: selectedParticipantId,
        items: [
          ...SAMPLE_LOCAL_WORKSPACE.items,
          {
            ...localItemLifecycle(),
            description: 'Hidden from the selected player',
            id: folderId,
            parentId: null,
            status: 'active',
            title: 'GM Only Folder',
            type: 'folder',
          },
          {
            ...localItemLifecycle(),
            description: 'Visible to the selected player',
            id: noteId,
            parentId: folderId,
            status: 'active',
            title: 'Player Clue',
            type: 'note',
          },
        ],
        memberItemPermissionsById: {
          ...SAMPLE_LOCAL_WORKSPACE.memberItemPermissionsById,
          [folderId]: { [selectedParticipantId]: PERMISSION_LEVEL.NONE },
          [noteId]: { [selectedParticipantId]: PERMISSION_LEVEL.VIEW },
        },
        noteBodiesById: {
          ...SAMPLE_LOCAL_WORKSPACE.noteBodiesById,
          [noteId]: 'A clue the selected player can read.',
        },
      },
    })

    const note = filesystem.catalog.getVisibleItemById(noteId as SidebarItemId)

    expect(filesystem.catalog.getVisibleItemById(folderId as SidebarItemId)).toBeNull()
    expect(note).toMatchObject({
      id: noteId,
      ancestors: [],
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
      parentId: null,
    })
  })

  it('projects local view-as as a read-only player-visible filesystem', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)
    const filesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      setSelectedViewAsPlayerId: vi.fn(),
      workspace: scenario.workspace,
    })

    expect(filesystem.catalog.getVisibleItems().map((item) => item.id)).toEqual([
      'canvas-heist',
      'map-docks',
      'file-handout',
      'file-tunnel-sketch',
    ])

    const map = filesystem.catalog.getVisibleItemById('map-docks' as SidebarItemId)
    if (!map) {
      throw new Error('Expected selected player to see the shared local map')
    }

    expect(filesystem.permissions.workspaceMode).toBe(WORKSPACE_MODE.VIEWER)
    expect(filesystem.permissions.canAccessItem(map, PERMISSION_LEVEL.VIEW)).toBe(true)
    expect(filesystem.permissions.canMutateItem(map, PERMISSION_LEVEL.EDIT)).toBe(false)
    expect(
      filesystem.operations.createItem({
        type: TEST_RESOURCE_TYPES.notes,
        parentTarget: { kind: TEST_PARENT_TARGET_KIND.direct, parentId: null },
      }),
    ).toEqual({ status: 'unavailable', reason: 'create_items_unsupported' })
  })

  it('starts selected-player local navigation on a visible item', () => {
    const selectedParticipantId = 'demo-member-mira' as CampaignMemberId
    const filesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      setSelectedViewAsPlayerId: vi.fn(),
      workspace: {
        ...SAMPLE_LOCAL_WORKSPACE,
        selectedViewAsPlayerId: selectedParticipantId,
        memberItemPermissionsById: {
          'note-market': { [selectedParticipantId]: PERMISSION_LEVEL.NONE },
          'canvas-heist': { [selectedParticipantId]: PERMISSION_LEVEL.VIEW },
        },
      },
    })

    expect(filesystem.current.contentItem).toMatchObject({
      id: 'canvas-heist',
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    expect(filesystem.current.availabilityState).toMatchObject({
      status: 'available',
      item: filesystem.current.contentItem,
    })
  })

  it('projects collaborative public demo sharing state through the local runtime', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes)
    const runtime = createLocalRuntime({
      dispatch: vi.fn(),
      setSelectedViewAsPlayerId: vi.fn(),
      workspace: scenario.workspace,
    })
    const filesystem = createTestRuntimeFileSystem(runtime)

    expect(runtime.sharing.viewAsParticipant).toMatchObject({
      status: 'available',
      selectedParticipantId: 'demo-member-mira',
      participants: [
        expect.objectContaining({
          id: 'demo-member-mira',
          displayName: 'Mira',
        }),
      ],
    })

    const sessionNote = requireLocalNoteWithContent(filesystem, 'note-session')
    expect(sessionNote).toMatchObject({
      name: 'Session Notes',
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    expect(getNoteText(sessionNote.content)).toContain('Scene: Moonwell Docks')
    expect(getNoteText(sessionNote.content)).toContain('Jun adds:')

    const embeddedPrepBlock = sessionNote.content.find(
      (block) =>
        block.type === 'embed' &&
        block.props.targetKind === 'resource' &&
        block.props.resourceId === 'note-market',
    )
    if (!embeddedPrepBlock) {
      throw new Error('Expected Session Notes to embed the revealed prep note')
    }
    expect(sessionNote.blockMeta[embeddedPrepBlock.id]).toMatchObject({
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    const prepNote = requireLocalNoteWithContent(filesystem, 'note-market')
    expect(prepNote.myPermissionLevel).toBe(PERMISSION_LEVEL.VIEW)
    expect(filesystem.permissions.canAccessItem(prepNote, PERMISSION_LEVEL.VIEW)).toBe(true)
    expect(
      prepNote.blockMeta[
        findNoteBlockByText(prepNote, 'Players know the public auction starts at dusk.').id
      ],
    ).toMatchObject({
      shareStatus: SHARE_STATUS.ALL_SHARED,
    })
    expect(
      prepNote.blockMeta[
        findNoteBlockByText(prepNote, 'GM secret: Mara Vell planted the blue-glass invoice').id
      ],
    ).toMatchObject({
      shareStatus: SHARE_STATUS.ALL_SHARED,
    })
  })

  it('keeps local view-as unsupported when player selection cannot change', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)
    const runtime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: scenario.workspace,
    })

    expect(runtime.sharing.viewAsParticipant).toEqual({
      status: 'unsupported',
      reason: 'not_available',
    })
  })

  it('keeps parent targets on locally created items', () => {
    const workspace = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    const created = filesystem.operations.createItem({
      type: TEST_RESOURCE_TYPES.notes,
      parentTarget: { kind: TEST_PARENT_TARGET_KIND.direct, parentId: folderId },
      name: 'Folder note',
    })

    expect(created).toEqual({ status: 'completed', id: 'local-note-3', slug: 'local-note-3' })
    expectCreateItemDispatch(dispatch, {
      id: 'local-note-3',
      parentId: 'local-folder-2',
      type: 'note',
    })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const nextFilesystem = nextRuntime.resources
    const child = nextFilesystem.catalog.getKnownItemById('local-note-3' as SidebarItemId)

    expect(child).toMatchObject({
      parentId: folderId,
      ancestors: [expect.objectContaining({ id: folderId, name: 'Untitled Folder' })],
    })
  })

  it('projects local create metadata through the filesystem catalog', () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const created = filesystem.operations.createItem({
      type: TEST_RESOURCE_TYPES.files,
      parentTarget: { kind: TEST_PARENT_TARGET_KIND.direct, parentId: null },
      name: 'Styled file',
      iconName: 'FileText',
      color: testResourceColor('#22cc88'),
    })

    expect(created).toEqual({ status: 'completed', id: 'local-file-2', slug: 'local-file-2' })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const nextFilesystem = nextRuntime.resources

    expect(nextFilesystem.catalog.getKnownItemById('local-file-2' as SidebarItemId)).toMatchObject({
      id: 'local-file-2',
      color: '#22cc88',
      iconName: 'FileText',
      name: 'Styled file',
      type: TEST_RESOURCE_TYPES.files,
    })
  })

  it('reserves unique local creation receipts for same-tick creates', () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const firstCreated = filesystem.operations.createItem({
      type: TEST_RESOURCE_TYPES.notes,
      parentTarget: { kind: TEST_PARENT_TARGET_KIND.direct, parentId: null },
      name: 'First local note',
    })
    const secondCreated = filesystem.operations.createItem({
      type: TEST_RESOURCE_TYPES.notes,
      parentTarget: { kind: TEST_PARENT_TARGET_KIND.direct, parentId: null },
      name: 'Second local note',
    })

    expect(firstCreated).toEqual({ status: 'completed', id: 'local-note-2', slug: 'local-note-2' })
    expect(secondCreated).toEqual({ status: 'completed', id: 'local-note-3', slug: 'local-note-3' })
    expectCreateItemDispatch(dispatch, { id: 'local-note-2', parentId: null, type: 'note' })
    expectCreateItemDispatch(dispatch, { id: 'local-note-3', parentId: null, type: 'note' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-note-2',
      title: 'First local note',
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-note-3',
      title: 'Second local note',
    })
  })

  it('creates missing folder paths through the filesystem create operation', () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const created = filesystem.operations.createItem({
      type: TEST_RESOURCE_TYPES.notes,
      parentTarget: {
        kind: TEST_PARENT_TARGET_KIND.path,
        baseParentId: null,
        pathSegments: ['Lore', 'Capital'],
      },
      name: 'Ghost Note',
    })

    expect(created).toEqual({ status: 'completed', id: 'local-note-4', slug: 'local-note-4' })
    expectCreateItemDispatch(dispatch, { id: 'local-folder-2', parentId: null, type: 'folder' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-folder-2',
      title: 'Lore',
    })
    expectCreateItemDispatch(dispatch, {
      id: 'local-folder-3',
      parentId: 'local-folder-2',
      type: 'folder',
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-folder-3',
      title: 'Capital',
    })
    expectCreateItemDispatch(dispatch, {
      id: 'local-note-4',
      parentId: 'local-folder-3',
      type: 'note',
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-note-4',
      title: 'Ghost Note',
    })
  })

  it('reuses same-tick local folders created for a missing filesystem path', () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const parentTarget = {
      kind: TEST_PARENT_TARGET_KIND.path,
      baseParentId: null,
      pathSegments: ['Lore', 'Capital'],
    }

    const firstCreated = filesystem.operations.createItem({
      type: TEST_RESOURCE_TYPES.notes,
      parentTarget,
      name: 'Ghost Note',
    })
    const secondCreated = filesystem.operations.createItem({
      type: TEST_RESOURCE_TYPES.notes,
      parentTarget,
      name: 'Second Ghost Note',
    })

    expect(firstCreated).toEqual({ status: 'completed', id: 'local-note-4', slug: 'local-note-4' })
    expect(secondCreated).toEqual({ status: 'completed', id: 'local-note-5', slug: 'local-note-5' })
    expectCreateItemDispatch(dispatch, { id: 'local-folder-2', parentId: null, type: 'folder' })
    expectCreateItemDispatch(dispatch, {
      id: 'local-folder-3',
      parentId: 'local-folder-2',
      type: 'folder',
    })
    expectCreateItemDispatch(dispatch, {
      id: 'local-note-4',
      parentId: 'local-folder-3',
      type: 'note',
    })
    expectCreateItemDispatch(dispatch, {
      id: 'local-note-5',
      parentId: 'local-folder-3',
      type: 'note',
    })
    const createdFolders = dispatch.mock.calls
      .map(([action]) => action)
      .filter((action) => action.type === 'createItem' && action.creation.item.type === 'folder')
      .map((action) => action.creation.id)
    expect(createdFolders).toEqual(['local-folder-2', 'local-folder-3'])
  })

  it('keeps async path folder reservations when a concurrent create adopts them', async () => {
    const dispatch = vi.fn()
    const reportCreateItemError = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      reportCreateItemError,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const parentTarget = {
      kind: TEST_PARENT_TARGET_KIND.path,
      baseParentId: null,
      pathSegments: ['Lore', 'Capital'],
    }
    let failFirstInitialization!: (error: Error) => void
    let completeSecondInitialization!: () => void

    const firstCreated = filesystem.operations.createItem(
      {
        type: TEST_RESOURCE_TYPES.notes,
        parentTarget,
        name: 'Rolled Back',
      },
      () =>
        new Promise<void>((_, reject) => {
          failFirstInitialization = reject
        }),
    )
    const secondCreated = filesystem.operations.createItem(
      {
        type: TEST_RESOURCE_TYPES.notes,
        parentTarget,
        name: 'Kept Note',
      },
      () =>
        new Promise<void>((resolve) => {
          completeSecondInitialization = resolve
        }),
    )

    completeSecondInitialization()
    await expect(Promise.resolve(secondCreated)).resolves.toEqual({
      status: 'completed',
      id: 'local-note-5',
      slug: 'local-note-5',
    })
    failFirstInitialization(new Error('Initialization failed'))
    await expect(Promise.resolve(firstCreated)).resolves.toMatchObject({
      status: 'failed',
      reason: 'create_failed',
      error: expect.any(Error),
    })

    const createdFolders = dispatch.mock.calls
      .map(([action]) => action)
      .filter((action) => action.type === 'createItem' && action.creation.item.type === 'folder')
      .map((action) => action.creation.id)
    expect(createdFolders).toEqual(['local-folder-2', 'local-folder-3'])
    expectCreateItemDispatch(dispatch, {
      id: 'local-note-5',
      parentId: 'local-folder-3',
      type: 'note',
    })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })

    expect(
      nextFilesystem.catalog.getKnownItemById('local-folder-3' as SidebarItemId),
    ).toMatchObject({
      id: 'local-folder-3',
      name: 'Capital',
    })
    expect(nextFilesystem.catalog.getKnownItemById('local-note-5' as SidebarItemId)).toMatchObject({
      id: 'local-note-5',
      parentId: 'local-folder-3',
    })
    expect(nextFilesystem.catalog.getKnownItemById('local-note-4' as SidebarItemId)).toBeNull()
    expect(reportCreateItemError).toHaveBeenCalledWith(expect.any(Error), 'Failed to create item')
  })

  it('does not reuse rolled-back same-tick folders after create initialization fails', async () => {
    const dispatch = vi.fn()
    const reportCreateItemError = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      reportCreateItemError,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const parentTarget = {
      kind: TEST_PARENT_TARGET_KIND.path,
      baseParentId: null,
      pathSegments: ['Lore', 'Capital'],
    }

    const failedCreate = await filesystem.operations.createItem(
      {
        type: TEST_RESOURCE_TYPES.notes,
        parentTarget,
        name: 'Rolled Back',
      },
      () => {
        throw new Error('Initialization failed')
      },
    )
    const successfulCreate = filesystem.operations.createItem({
      type: TEST_RESOURCE_TYPES.notes,
      parentTarget,
      name: 'Fresh Note',
    })

    expect(failedCreate).toMatchObject({
      status: 'failed',
      reason: 'create_failed',
      error: expect.any(Error),
    })
    expect(successfulCreate).toEqual({
      status: 'completed',
      id: 'local-note-7',
      slug: 'local-note-7',
    })
    expectCreateItemDispatch(dispatch, { id: 'local-folder-2', parentId: null, type: 'folder' })
    expectCreateItemDispatch(dispatch, {
      id: 'local-folder-3',
      parentId: 'local-folder-2',
      type: 'folder',
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'trashItems',
      itemIds: ['local-folder-2', 'local-folder-3', 'local-note-4'],
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'deleteItemsForever',
      itemIds: ['local-folder-2', 'local-folder-3', 'local-note-4'],
    })
    expectCreateItemDispatch(dispatch, { id: 'local-folder-5', parentId: null, type: 'folder' })
    expectCreateItemDispatch(dispatch, {
      id: 'local-folder-6',
      parentId: 'local-folder-5',
      type: 'folder',
    })
    expectCreateItemDispatch(dispatch, {
      id: 'local-note-7',
      parentId: 'local-folder-6',
      type: 'note',
    })
    expect(reportCreateItemError).toHaveBeenCalledWith(expect.any(Error), 'Failed to create item')
  })

  it('normalizes relative segments while creating missing folder paths', () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const created = filesystem.operations.createItem({
      type: TEST_RESOURCE_TYPES.notes,
      parentTarget: {
        kind: TEST_PARENT_TARGET_KIND.path,
        baseParentId: null,
        pathSegments: ['Lore', '..', 'Archive'],
      },
      name: 'Chronicle',
    })

    expect(created).toEqual({ status: 'completed', id: 'local-note-3', slug: 'local-note-3' })
    expectCreateItemDispatch(dispatch, { id: 'local-folder-2', parentId: null, type: 'folder' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-folder-2',
      title: 'Archive',
    })
    expectCreateItemDispatch(dispatch, {
      id: 'local-note-3',
      parentId: 'local-folder-2',
      type: 'note',
    })
  })

  it('resolves parent traversal from the base folder while creating missing folder paths', () => {
    const rootFolderWorkspace = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const rootFolderId = 'local-folder-2' as SidebarItemId
    const nestedFolderWorkspace = createLocalTestItem(rootFolderWorkspace, 'folder', rootFolderId)
    const nestedFolderId = 'local-folder-3' as SidebarItemId
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: nestedFolderWorkspace,
    })

    const created = filesystem.operations.createItem({
      type: TEST_RESOURCE_TYPES.notes,
      parentTarget: {
        kind: TEST_PARENT_TARGET_KIND.path,
        baseParentId: nestedFolderId,
        pathSegments: ['..', 'Archive'],
      },
      name: 'Parent Chronicle',
    })

    expect(created).toEqual({ status: 'completed', id: 'local-note-5', slug: 'local-note-5' })
    expectCreateItemDispatch(dispatch, {
      id: 'local-folder-4',
      parentId: 'local-folder-2',
      type: 'folder',
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-folder-4',
      title: 'Archive',
    })
    expectCreateItemDispatch(dispatch, {
      id: 'local-note-5',
      parentId: 'local-folder-4',
      type: 'note',
    })
  })

  it('projects locally trashed items through the filesystem catalog', async () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    await filesystem.operations.trashItems(['note-market' as SidebarItemId])

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      SAMPLE_LOCAL_WORKSPACE,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })

    expect(nextFilesystem.catalog.getTrashedItems()).toEqual([
      expect.objectContaining({
        id: 'note-market',
        isTrashed: true,
      }),
    ])
  })

  it('filters locally trashed items by selected-player visibility', () => {
    const playerId = 'player-mira' as CampaignMemberId
    const workspace = localWorkspaceReducer(
      {
        ...SAMPLE_LOCAL_WORKSPACE,
        selectedViewAsPlayerId: playerId,
        memberItemPermissionsById: {
          'note-market': {
            [playerId]: PERMISSION_LEVEL.VIEW,
          },
        },
      },
      {
        type: 'trashItems',
        itemIds: ['file-handout'],
      },
    )
    const filesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace,
    })

    expect(filesystem.catalog.getTrashedItems()).toEqual([])
    expect(filesystem.catalog.getKnownItemById('file-handout' as SidebarItemId)).toBeNull()
  })

  it('removes note block visibility when permanently deleting local notes', () => {
    const visibilityRule = {
      textIncludes: 'Lantern Market',
      hiddenFrom: ['player-mira' as CampaignMemberId],
      shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
    }
    const workspace: LocalWorkspaceState = {
      ...SAMPLE_LOCAL_WORKSPACE,
      noteBlockVisibilityById: {
        ...SAMPLE_LOCAL_WORKSPACE.noteBlockVisibilityById,
        'note-market': [visibilityRule],
      },
    }

    const trashed = localWorkspaceReducer(workspace, {
      type: 'trashItems',
      itemIds: ['note-market'],
    })
    const deleted = localWorkspaceReducer(trashed, {
      type: 'deleteItemsForever',
      itemIds: ['note-market'],
    })

    expect(deleted.noteBlockVisibilityById?.['note-market']).toBeUndefined()
  })

  it('duplicates local items into a target parent through filesystem operations', async () => {
    const embeddedBlock = createLocalTestNoteEmbedBlock('copied-note-embed', 'file-handout')
    const visibilityRule = {
      textIncludes: 'Lantern Market',
      hiddenFrom: ['player-mira' as CampaignMemberId],
      shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
    }
    const workspace: LocalWorkspaceState = {
      ...createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null),
      noteAdditionalBlocksById: {
        ...SAMPLE_LOCAL_WORKSPACE.noteAdditionalBlocksById,
        'note-market': [embeddedBlock],
      },
      noteBlockVisibilityById: {
        ...SAMPLE_LOCAL_WORKSPACE.noteBlockVisibilityById,
        'note-market': [visibilityRule],
      },
    }
    const folderId = 'local-folder-2' as SidebarItemId
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    await copyLocalItems(filesystem, ['note-market' as SidebarItemId], folderId)

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const duplicate = nextFilesystem.catalog.getKnownItemById('local-note-3' as SidebarItemId)

    expect(duplicate).toMatchObject({
      id: 'local-note-3',
      name: 'The Lantern Market Copy',
      parentId: folderId,
      ancestors: [expect.objectContaining({ id: folderId })],
    })
    expect(duplicate).toMatchObject({ type: TEST_RESOURCE_TYPES.notes })
    expect(nextWorkspace.noteAdditionalBlocksById['local-note-3']).toEqual([embeddedBlock])
    expect(nextWorkspace.noteBlockVisibilityById?.['local-note-3']).toEqual([visibilityRule])
  })

  it('returns local command receipts for direct filesystem operations', async () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    await expect(
      Promise.resolve(filesystem.operations.toggleBookmarks(['note-market' as SidebarItemId])),
    ).resolves.toMatchObject({
      status: 'completed',
      receipt: {
        command: { type: 'toggleBookmarks', itemIds: ['note-market'] },
        events: [{ type: 'updated', itemId: 'note-market' }],
        summary: { kind: 'bookmarksUpdated', affectedCount: 1 },
        transactionId: null,
        undoable: false,
      },
    })

    await expect(
      Promise.resolve(filesystem.operations.trashItems(['note-market' as SidebarItemId])),
    ).resolves.toMatchObject({
      status: 'completed',
      receipt: {
        command: { type: 'trash', itemIds: ['note-market'] },
        events: [{ type: 'trashed', itemId: 'note-market' }],
        summary: { kind: 'trashed', affectedCount: 1 },
      },
    })
  })

  it('duplicates local files with their resolved content payload', async () => {
    const workspace = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    await copyLocalItems(filesystem, ['file-handout' as SidebarItemId], folderId)

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextRuntime = createLocalRuntime({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const nextFilesystem = nextRuntime.resources
    const duplicate = nextFilesystem.catalog.getKnownItemById(
      'local-file-3' as SidebarItemId,
    ) as LocalFileItemWithContent

    expect(duplicate).toMatchObject({
      id: 'local-file-3',
      name: 'Blue-glass Invoice Copy',
      parentId: folderId,
      type: TEST_RESOURCE_TYPES.files,
    })
    expect(nextRuntime.sessions.file.resolveFile(duplicate)).toMatchObject({
      allowDataUrl: true,
      contentType: 'text/plain',
      downloadUrl: expect.stringContaining('Blue-glass%20shipment%20invoice'),
      name: 'blue-glass-invoice.txt',
    })
  })

  it('keeps copied local item default titles aligned with generated ids', async () => {
    const workspaceWithFolder = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const workspace: LocalWorkspaceState = {
      ...workspaceWithFolder,
      items: workspaceWithFolder.items.map((item) =>
        item.id === 'note-market' ? { ...item, title: '' } : item,
      ),
    }
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    await copyLocalItems(filesystem, ['note-market' as SidebarItemId], folderId)

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })

    expect(nextFilesystem.catalog.getKnownItemById('local-note-3' as SidebarItemId)).toMatchObject({
      id: 'local-note-3',
      name: 'Untitled Note 3 Copy',
      parentId: folderId,
    })
  })

  it('duplicates local canvases with independent document payloads', () => {
    const nextWorkspace = applyLocalCopyReceipt(SAMPLE_LOCAL_WORKSPACE, ['canvas-heist'], null, [
      ['canvas-heist', 'local-canvas-2'],
    ])

    const originalCanvas = SAMPLE_LOCAL_WORKSPACE.canvasPayloadsById['canvas-heist']
    const copiedCanvas = nextWorkspace.canvasPayloadsById['local-canvas-2']

    expect(copiedCanvas).toBeDefined()
    expect(copiedCanvas?.nodes).toEqual(originalCanvas?.nodes)
    expect(copiedCanvas?.edges).toEqual(originalCanvas?.edges)
    expect(copiedCanvas?.nodes[0]).not.toBe(originalCanvas?.nodes[0])
    expect(copiedCanvas?.nodes[0]?.position).not.toBe(originalCanvas?.nodes[0]?.position)
    expect(copiedCanvas?.nodes[0]?.data).not.toBe(originalCanvas?.nodes[0]?.data)
  })

  it('retargets copied local map pins to copied descendants', async () => {
    const workspaceWithFolder = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const workspaceWithMap = createLocalTestItem(workspaceWithFolder, 'map', folderId)
    const mapId = 'local-map-3'
    const workspaceWithNote = createLocalTestItem(workspaceWithMap, 'note', folderId)
    const noteId = 'local-note-4'
    const workspace: LocalWorkspaceState = {
      ...workspaceWithNote,
      mapsById: {
        ...workspaceWithNote.mapsById,
        [mapId]: {
          ...workspaceWithNote.mapsById[mapId]!,
          pins: [
            {
              id: 'local-map-pin-copy-target',
              itemId: noteId,
              x: 32,
              y: 48,
              visible: true,
              creationTime: 0,
            },
          ],
        },
      },
    }
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    await copyLocalItems(filesystem, [folderId], null)

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const copiedMap = nextFilesystem.catalog.getKnownItemById(
      'local-map-6' as SidebarItemId,
    ) as LocalMapItemWithContent

    expect(findMapPin(copiedMap, 'local-note-7')).toMatchObject({
      itemId: 'local-note-7',
    })
  })

  it('copies local folder trees with the copy suffix only on copied roots', async () => {
    const workspaceWithFolder = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const workspace = createLocalTestItem(workspaceWithFolder, 'note', folderId)
    const sourceFolder = workspace.items.find((item) => item.id === folderId)
    const sourceChild = workspace.items.find((item) => item.id === 'local-note-3')
    if (!sourceFolder || !sourceChild) {
      throw new Error('Expected local folder tree fixture to include a folder and child note')
    }
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    await copyLocalItems(filesystem, [folderId], null)

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })

    expect(
      nextFilesystem.catalog.getKnownItemById('local-folder-4' as SidebarItemId),
    ).toMatchObject({
      id: 'local-folder-4',
      name: `${sourceFolder.title} Copy`,
      parentId: null,
    })
    expect(nextFilesystem.catalog.getKnownItemById('local-note-5' as SidebarItemId)).toMatchObject({
      id: 'local-note-5',
      name: sourceChild.title,
      parentId: 'local-folder-4',
    })
  })

  it('fails fast when copying a local map without its content payload', () => {
    const workspaceWithFolder = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const workspaceWithMap = createLocalTestItem(workspaceWithFolder, 'map', folderId)
    const { 'local-map-3': _missingMap, ...mapsById } = workspaceWithMap.mapsById
    const workspace: LocalWorkspaceState = {
      ...workspaceWithMap,
      mapsById,
    }

    expect(() =>
      applyLocalCopyReceipt(workspace, ['local-map-3'], null, [['local-map-3', 'local-map-4']]),
    ).toThrow('Missing local map payload for local-map-3')
  })

  it('pastes copied local items through the runtime clipboard operations', async () => {
    const workspace = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    if (filesystem.operations.clipboard.status !== 'available') {
      throw new Error('Expected local clipboard operations to be available')
    }

    filesystem.operations.clipboard.copyItems(['note-market' as SidebarItemId])
    await expect(
      Promise.resolve(filesystem.operations.clipboard.paste(folderId)),
    ).resolves.toMatchObject({
      status: 'completed',
      receipt: {
        command: {
          type: 'copy',
          itemIds: ['note-market'],
          targetParentId: folderId,
        },
        events: [
          {
            type: 'copied',
            itemId: 'local-note-3',
            sourceItemId: 'note-market',
          },
        ],
        summary: { kind: 'copied', affectedCount: 1 },
      },
    })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })

    expect(nextFilesystem.catalog.getKnownItemById('local-note-3' as SidebarItemId)).toMatchObject({
      id: 'local-note-3',
      name: 'The Lantern Market Copy',
      parentId: folderId,
    })
  })

  it('does not advertise target paste actions for read-only local workspaces', () => {
    const workspace = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const editableFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace,
    })

    if (editableFilesystem.operations.clipboard.status !== 'available') {
      throw new Error('Expected local clipboard operations to be available')
    }

    editableFilesystem.operations.clipboard.copyItems(['note-market' as SidebarItemId])
    const editableFolder = editableFilesystem.catalog.getKnownItemById(folderId)

    if (!editableFolder) {
      throw new Error('Expected editable local test folder')
    }

    expect(
      editableFilesystem.operations.canPasteIntoTarget({
        clickedItem: editableFolder,
      }),
    ).toBe(true)

    const readOnlyFilesystem = createLocalRuntimeFileSystem({
      canEdit: false,
      dispatch: vi.fn(),
      workspace,
    })
    const folder = readOnlyFilesystem.catalog.getKnownItemById(folderId)

    if (!folder) {
      throw new Error('Expected local test folder')
    }

    expect(
      readOnlyFilesystem.operations.canPasteIntoTarget({
        clickedItem: folder,
      }),
    ).toBe(false)
  })

  it('keeps local clipboard cancellation scoped to the current workspace', async () => {
    const workspace = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    if (filesystem.operations.clipboard.status !== 'available') {
      throw new Error('Expected local clipboard operations to be available')
    }

    filesystem.operations.clipboard.copyItems(['note-market' as SidebarItemId])

    const otherFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: {
        ...workspace,
        workspaceId: 'other-local-workspace' as LocalWorkspaceState['workspaceId'],
      },
    })

    if (otherFilesystem.operations.clipboard.status !== 'available') {
      throw new Error('Expected other local clipboard operations to be available')
    }

    expect(otherFilesystem.operations.clipboard.cancel()).toBe(false)

    await filesystem.operations.clipboard.paste(folderId)

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })

    expect(nextFilesystem.catalog.getKnownItemById('local-note-3' as SidebarItemId)).toMatchObject({
      id: 'local-note-3',
      parentId: folderId,
    })
  })

  it('keeps local clipboard operations scoped to the current runtime instance', async () => {
    const workspace = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      runtimeInstanceId: 'runtime-a',
      workspace,
    })

    if (filesystem.operations.clipboard.status !== 'available') {
      throw new Error('Expected local clipboard operations to be available')
    }

    filesystem.operations.clipboard.copyItems(['note-market' as SidebarItemId])

    const otherDispatch = vi.fn()
    const otherFilesystem = createLocalRuntimeFileSystem({
      dispatch: otherDispatch,
      runtimeInstanceId: 'runtime-b',
      workspace,
    })

    if (otherFilesystem.operations.clipboard.status !== 'available') {
      throw new Error('Expected other local clipboard operations to be available')
    }

    expect(otherFilesystem.operations.clipboard.paste(folderId)).toEqual({
      status: 'unavailable',
      reason: 'clipboard_empty',
    })
    expect(otherDispatch).not.toHaveBeenCalled()

    await filesystem.operations.clipboard.paste(folderId)

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      runtimeInstanceId: 'runtime-a',
      workspace: nextWorkspace,
    })

    expect(nextFilesystem.catalog.getKnownItemById('local-note-3' as SidebarItemId)).toMatchObject({
      id: 'local-note-3',
      parentId: folderId,
    })
  })

  it('ignores local clipboard items that are stale in the active runtime catalog', () => {
    const workspace = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const filesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      runtimeInstanceId: 'runtime-a',
      workspace,
    })

    if (filesystem.operations.clipboard.status !== 'available') {
      throw new Error('Expected local clipboard operations to be available')
    }

    filesystem.operations.clipboard.copyItems(['note-market' as SidebarItemId])

    const staleWorkspace = localWorkspaceReducer(workspace, {
      type: 'trashItems',
      itemIds: ['note-market'],
    })
    const dispatch = vi.fn()
    const staleFilesystem = createLocalRuntimeFileSystem({
      dispatch,
      runtimeInstanceId: 'runtime-a',
      workspace: staleWorkspace,
    })

    if (staleFilesystem.operations.clipboard.status !== 'available') {
      throw new Error('Expected stale local clipboard operations to be available')
    }

    expect(staleFilesystem.operations.clipboard.paste(folderId)).toEqual({
      status: 'unavailable',
      reason: 'clipboard_empty',
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('moves cut local items through the runtime clipboard operations', async () => {
    const workspace = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    if (filesystem.operations.clipboard.status !== 'available') {
      throw new Error('Expected local clipboard operations to be available')
    }

    filesystem.operations.clipboard.cutItems(['canvas-heist' as SidebarItemId])
    await filesystem.operations.clipboard.paste(folderId)

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })

    expect(nextFilesystem.catalog.getKnownItemById('canvas-heist' as SidebarItemId)).toMatchObject({
      id: 'canvas-heist',
      parentId: folderId,
    })
  })

  it('returns a no-op local receipt when a stale move target is inside the moved tree', async () => {
    const workspaceWithFolder = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const workspace = createLocalTestItem(workspaceWithFolder, 'note', folderId)
    const childId = 'local-note-3' as SidebarItemId
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    if (filesystem.operations.clipboard.status !== 'available') {
      throw new Error('Expected local clipboard operations to be available')
    }

    filesystem.operations.clipboard.cutItems([folderId])

    await expect(
      Promise.resolve(filesystem.operations.clipboard.paste(childId)),
    ).resolves.toMatchObject({
      status: 'completed',
      receipt: {
        command: {
          type: 'move',
          itemIds: [folderId],
          targetParentId: childId,
        },
        events: [],
        summary: { kind: 'noop', affectedCount: 0 },
      },
    })

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )

    expect(nextWorkspace.items.find((item) => item.id === folderId)).toMatchObject({
      parentId: null,
    })
  })

  it('copies local folders while preserving trashed descendants in trash', async () => {
    const workspaceWithFolder = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const workspaceWithChild = createLocalTestItem(workspaceWithFolder, 'note', folderId)
    const workspace = localWorkspaceReducer(workspaceWithChild, {
      type: 'trashItems',
      itemIds: ['local-note-3'],
    })
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    await copyLocalItems(filesystem, [folderId], null)

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })
    const folderCopy = nextFilesystem.catalog.getKnownItemById('local-folder-4' as SidebarItemId)

    expect(folderCopy).toMatchObject({
      id: 'local-folder-4',
      name: 'Untitled Folder Copy',
    })
    expect(nextFilesystem.catalog.getTrashedItems()).toEqual([
      expect.objectContaining({ id: 'local-note-3' }),
    ])
  })

  it('moves and restores local items through filesystem operations', async () => {
    const workspace = createLocalTestItem(SAMPLE_LOCAL_WORKSPACE, 'folder', null)
    const folderId = 'local-folder-2' as SidebarItemId
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace,
    })

    await moveLocalItems(filesystem, ['canvas-heist' as SidebarItemId], folderId)
    await filesystem.operations.trashItems(['canvas-heist' as SidebarItemId])
    await filesystem.operations.restoreItems(['canvas-heist' as SidebarItemId], null)

    const nextWorkspace = dispatch.mock.calls.reduce(
      (state, [action]) => localWorkspaceReducer(state, action),
      workspace,
    )
    const nextFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: nextWorkspace,
    })

    expect(
      nextFilesystem.catalog.getVisibleItemById('canvas-heist' as SidebarItemId),
    ).toMatchObject({
      id: 'canvas-heist',
      parentId: null,
      isTrashed: false,
    })
  })

  it('returns a zero-effect restore receipt for active or missing local items', async () => {
    const dispatch = vi.fn()
    const filesystem = createLocalRuntimeFileSystem({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    await expect(
      Promise.resolve(filesystem.operations.restoreItems(['note-market' as SidebarItemId], null)),
    ).resolves.toMatchObject({
      status: 'completed',
      receipt: { events: [], summary: { kind: 'noop', affectedCount: 0 } },
    })
    await expect(
      Promise.resolve(filesystem.operations.restoreItems(['missing-item' as SidebarItemId], null)),
    ).resolves.toMatchObject({
      status: 'completed',
      receipt: { events: [], summary: { kind: 'noop', affectedCount: 0 } },
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('routes local editor mode changes through the supplied runtime setter', () => {
    const setWorkspaceMode = vi.fn()
    const editableFilesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspaceMode: WORKSPACE_MODE.EDITOR,
      setWorkspaceMode,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    editableFilesystem.permissions.setWorkspaceMode(WORKSPACE_MODE.VIEWER)

    expect(setWorkspaceMode).toHaveBeenCalledExactlyOnceWith(WORKSPACE_MODE.VIEWER)
  })

  it('derives the current item state from local runtime navigation input', () => {
    const runtime = createLocalRuntime({
      dispatch: vi.fn(),
      navigation: {
        kind: 'resource',
        resource: createWizardEditorResource('canvas-heist' as SidebarItemId),
      },
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const filesystem = runtime.resources

    expect(getWizardEditorNavigationCurrentResourceId(runtime.navigation)).toBe('canvas-heist')
    expect(filesystem.current.contentItem).toBe(
      filesystem.catalog.getKnownItemById('canvas-heist' as SidebarItemId),
    )
    expect(filesystem.current.availabilityState).toMatchObject({
      status: 'available',
      item: filesystem.current.contentItem,
    })
  })

  it('routes separate item navigation through the supplied local adapter capability', () => {
    const openSeparateItem = vi.fn()
    const runtime = createLocalRuntime({
      dispatch: vi.fn(),
      openSeparateItem,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    expect(runtime.navigation.canOpenItemsSeparately).toEqual({ status: 'available' })

    runtime.navigation.openItem(createWizardEditorResource('canvas-heist' as SidebarItemId), {
      heading: 'Scene 2',
      target: 'separate',
    })

    expect(openSeparateItem).toHaveBeenCalledExactlyOnceWith({
      heading: 'Scene 2',
      itemId: 'canvas-heist',
    })
  })

  it('does not fall back to current-surface navigation without a separate item capability', () => {
    const setNavigation = vi.fn()
    const runtime = createLocalRuntime({
      dispatch: vi.fn(),
      setNavigation,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    expect(runtime.navigation.canOpenItemsSeparately).toEqual({
      status: 'unsupported',
      reason: 'separate_navigation_unsupported',
    })

    expect(
      runtime.navigation.openItem(createWizardEditorResource('canvas-heist' as SidebarItemId), {
        target: 'separate',
      }),
    ).toEqual({
      status: 'unavailable',
      reason: 'separate_navigation_unsupported',
    })

    expect(setNavigation).not.toHaveBeenCalled()
  })

  it('routes external urls through the supplied local adapter capability', () => {
    const openExternalUrl = vi.fn()
    const runtime = createLocalRuntime({
      dispatch: vi.fn(),
      openExternalUrl,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    runtime.navigation.openExternalUrl('https://example.com/resource')

    expect(openExternalUrl).toHaveBeenCalledExactlyOnceWith('https://example.com/resource')
  })

  it('keeps local filesystem selection scoped to the current workspace item', () => {
    const filesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    expect(filesystem.selection.selectedItemIds).toEqual(['note-market'])
  })
})

function expectCreateItemDispatch(
  dispatch: ReturnType<typeof vi.fn>,
  {
    id,
    parentId,
    type,
  }: {
    id: string
    parentId: string | null
    type: 'canvas' | 'file' | 'folder' | 'map' | 'note'
  },
) {
  expect(dispatch).toHaveBeenCalledWith({
    type: 'createItem',
    creation: expect.objectContaining({
      id,
      item: expect.objectContaining({
        id,
        parentId,
        type,
      }),
    }),
  })
}

function findMapPinItem(map: LocalMapItemWithContent, itemId: string) {
  return findMapPin(map, itemId).item
}

function findMapPin(map: LocalMapItemWithContent, itemId: string) {
  const pin = map.pins.find((candidate) => String(candidate.itemId) === itemId)
  if (!pin) {
    throw new Error(`Expected map pin for ${itemId}`)
  }
  return pin
}

function requireLocalNoteWithContent(
  filesystem: ReturnType<typeof createLocalRuntimeFileSystem>,
  itemId: string,
): LocalNoteItemWithContent {
  const item = filesystem.catalog.getKnownItemById(itemId as SidebarItemId)
  if (!item || item.type !== TEST_RESOURCE_TYPES.notes) {
    throw new Error(`Expected local note ${itemId}`)
  }
  return item as LocalNoteItemWithContent
}

function findNoteBlockByText(note: LocalNoteItemWithContent, text: string): LocalNoteBlock {
  const block = note.content.find((candidate) => getNoteText(candidate).includes(text))
  if (!block) {
    throw new Error(`Expected note block containing "${text}"`)
  }
  return block
}

function getNoteText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(getNoteText).join('')
  }
  if (!value || typeof value !== 'object') return ''
  if ('text' in value && typeof value.text === 'string') {
    return value.text
  }
  return Object.values(value).map(getNoteText).join('')
}

function createLocalTestItem(
  workspace: LocalWorkspaceState,
  type: 'folder' | 'map' | 'note',
  parentId: SidebarItemId | null,
): LocalWorkspaceState {
  const dispatch = vi.fn()
  const filesystem = createLocalRuntimeFileSystem({ dispatch, workspace })
  const sidebarType =
    type === 'folder'
      ? TEST_RESOURCE_TYPES.folders
      : type === 'map'
        ? TEST_RESOURCE_TYPES.gameMaps
        : TEST_RESOURCE_TYPES.notes
  const created = filesystem.operations.createItem({
    type: sidebarType,
    parentTarget: { kind: TEST_PARENT_TARGET_KIND.direct, parentId },
  })
  if (isPromiseLike(created)) {
    throw new Error(`Expected local ${type} creation to be synchronous`)
  }
  if (created.status !== 'completed') {
    throw new Error(`Expected local ${type} creation to succeed`)
  }

  return dispatch.mock.calls.reduce(
    (state, [action]) => localWorkspaceReducer(state, action),
    workspace,
  )
}

function createLocalImportFile({
  arrayBuffer,
  bytes = [],
  contentType = 'application/octet-stream',
  name = 'file.bin',
  size = bytes.length,
}: {
  arrayBuffer?: () => ArrayBuffer
  bytes?: Array<number>
  contentType?: string
  name?: string
  size?: number
} = {}): LocalImportFile {
  return {
    name,
    contentType,
    size,
    arrayBuffer: arrayBuffer ?? (() => new Uint8Array(bytes).buffer),
    text: () => '',
  }
}

function localItemLifecycle() {
  return {
    createdAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
    trashedAt: null,
    updatedAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
  }
}

function testResourceColor(color: string): NonNullable<WizardEditorItem['color']> {
  const normalized = color.toLowerCase()
  if (!/^#[\da-f]{6}$/.test(normalized)) {
    throw new Error(`Invalid test resource color ${color}`)
  }
  return normalized as NonNullable<WizardEditorItem['color']>
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function createLocalTestNoteEmbedBlock(blockId: string, sidebarItemId: string): LocalNoteBlock {
  return {
    id: testNoteBlockId(blockId),
    type: 'embed',
    props: {
      targetKind: 'resource',
      resourceId: sidebarItemId,
    },
    content: undefined,
    children: [],
  }
}

type LocalRuntimeFileSystem = ReturnType<typeof createLocalRuntimeFileSystem>

function copyLocalItems(
  filesystem: LocalRuntimeFileSystem,
  itemIds: Array<SidebarItemId>,
  targetParentId: SidebarItemId | null,
) {
  resolveLocalOperationItems(filesystem, itemIds)
  return filesystem.operations.executeDropCommand({
    type: 'copy',
    itemIds,
    targetParentId,
  })
}

function moveLocalItems(
  filesystem: LocalRuntimeFileSystem,
  itemIds: Array<SidebarItemId>,
  targetParentId: SidebarItemId | null,
) {
  resolveLocalOperationItems(filesystem, itemIds)
  return filesystem.operations.executeDropCommand({
    type: 'move',
    itemIds,
    targetParentId,
  })
}

function resolveLocalOperationItems(
  filesystem: LocalRuntimeFileSystem,
  itemIds: Array<SidebarItemId>,
) {
  const items = filesystem.operationItems.resolveItems({ itemIds, includeTrashed: true })
  if (items.length !== itemIds.length) {
    throw new Error('Expected local operation items to resolve')
  }
  return items
}

function createLocalRuntimeFileSystem(options: LocalFileSystemAdapterTestOptions) {
  return createTestRuntimeFileSystem(createLocalRuntime(options))
}

function createLocalRuntime(options: LocalFileSystemAdapterTestOptions) {
  const { navigation, setNavigation, workspace, ...adapterOptions } = options
  return createLocalWorkspaceRuntimeBase({
    canvasEmbedded: createTestCanvasEmbeddedSessionPorts(),
    canvasPreviewUpload: { status: 'unsupported' },
    canvasSession: createTestCanvasSessionPorts(),
    snapshot: createLocalFileSystemSnapshot(
      workspace,
      navigation ?? createLocalWorkspaceInitialNavigation(workspace),
    ),
    workspaceMode: WORKSPACE_MODE.EDITOR,
    noteHeadings: createTestNoteHeadingSessionPorts(),
    notePlayback: createTestNotePlaybackSessionPorts(),
    noteSession: createTestNoteSessionPorts(),
    noteValues: createTestNoteValueSessionPorts(),
    openExternalUrl: vi.fn(),
    reportCreateItemError: vi.fn(),
    setNavigation: setNavigation ?? vi.fn(),
    setWorkspaceMode: vi.fn(),
    ...adapterOptions,
  })
}

function createTestRuntimeFileSystem(runtime: WizardEditorRuntime) {
  return {
    ...runtime.resources,
    operations: runtime.commands.operations,
    search: runtime.search.items,
    download: runtime.io.download,
    history: runtime.history,
    sharing: runtime.sharing,
  }
}

function applyLocalCopyReceipt(
  state: LocalWorkspaceState,
  itemIds: Array<string>,
  targetParentId: string | null,
  copies: Array<readonly [sourceItemId: string, copiedItemId: string]>,
) {
  const result = completeWizardEditorResourceCommand(
    {
      type: WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.copy,
      itemIds: itemIds as Array<SidebarItemId>,
      targetParentId: targetParentId as SidebarItemId | null,
    },
    copies.map(([sourceItemId, itemId]) => ({
      type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.copied,
      sourceItemId: sourceItemId as SidebarItemId,
      itemId: itemId as SidebarItemId,
    })),
  )
  if (result.status !== 'completed') throw new Error('Expected completed local copy receipt')
  return localWorkspaceReducer(state, {
    type: 'applyResourceCommandReceipt',
    receipt: result.receipt,
  })
}

type LocalFileSystemAdapterTestOptions = Omit<
  Parameters<typeof createLocalWorkspaceRuntimeBase>[0],
  | 'canvasSession'
  | 'canvasEmbedded'
  | 'canvasPreviewUpload'
  | 'snapshot'
  | 'workspaceMode'
  | 'noteHeadings'
  | 'notePlayback'
  | 'noteSession'
  | 'noteValues'
  | 'openExternalUrl'
  | 'reportCreateItemError'
  | 'setNavigation'
  | 'setWorkspaceMode'
> & {
  navigation?: WizardEditorNavigationState
  setNavigation?: (navigation: WizardEditorNavigationState) => void
  workspace: LocalWorkspaceState
} & Partial<
    Pick<
      Parameters<typeof createLocalWorkspaceRuntimeBase>[0],
      | 'canvasEmbedded'
      | 'canvasPreviewUpload'
      | 'noteHeadings'
      | 'notePlayback'
      | 'noteSession'
      | 'noteValues'
      | 'openExternalUrl'
      | 'reportCreateItemError'
      | 'workspaceMode'
      | 'setWorkspaceMode'
    >
  >
