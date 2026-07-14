import { testResourceId } from '../../../../../shared/test/resource-id'
import { describe, expect, expectTypeOf, it } from 'vite-plus/test'
import '../drop-command'
import type { DropPayload, PlannedDropCommand } from '../drop-command'
import { resolveDropCommand } from '../drop-command-planner'
import type { DropPlanningContext } from '../planning-context'
import {
  CANVAS_DROP_ZONE_TYPE,
  EMPTY_EMBED_DROP_TYPE,
  EMPTY_EDITOR_DROP_TYPE,
  NOTE_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
  TRASH_DROP_ZONE_TYPE,
} from '../drop-target-data'
import {
  createFolder as createFolderFixture,
  createNote as createNoteFixture,
} from '../../test/sidebar-item-factory'
import { testCampaignId } from '../../../../../shared/test/campaign-id'

const emptyExternalPayload: DropPayload = {
  kind: 'externalFiles',
  dropResult: { files: [], rootFolders: [] },
}

const campaignId = testCampaignId('campaign_1')

function createNote(overrides: Parameters<typeof createNoteFixture>[0] = {}) {
  return createNoteFixture({ campaignId, ...overrides })
}

function createFolder(overrides: Parameters<typeof createFolderFixture>[0] = {}) {
  return createFolderFixture({ campaignId, ...overrides })
}

function planningContext(overrides?: Partial<DropPlanningContext>): DropPlanningContext {
  return {
    workspaceId: campaignId,
    workspaceName: 'Test Campaign',
    canCreateRootItems: true,
    canManageFolders: true,
    ...overrides,
  }
}

function testDropResult({
  files = [],
  rootFolders = [],
}: {
  files?: Array<{ name: string }>
  rootFolders?: Array<{ name: string }>
} = {}) {
  return {
    files: files.map(({ name }) => ({
      file: new File(['content'], name),
      relativePath: name,
    })),
    rootFolders: rootFolders.map(({ name }) => ({
      name,
      relativePath: name,
      files: [],
      subfolders: [],
    })),
  }
}

describe('drop command model', () => {
  it('models external files as a first-class payload', () => {
    expect(emptyExternalPayload.kind).toBe('externalFiles')
  })

  it('models external URLs as a first-class payload', () => {
    const payload: DropPayload = {
      kind: 'externalUrl',
      target: {
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      },
    }

    expect(payload.kind).toBe('externalUrl')
  })

  it('models target-specific file upload without handled/unhandled fallback state', () => {
    const command: PlannedDropCommand = {
      kind: 'surfaceFileImport',
      commandId: 'surface-file-import.canvas',
      target: { type: 'canvas-drop-zone', canvasId: 'canvas-1' as never },
      dropResult: { files: [], rootFolders: [] },
      label: 'Upload to canvas',
    }

    expect(command.kind).toBe('surfaceFileImport')
  })

  it('models target-specific URL drops without direct surface mutation', () => {
    const command: PlannedDropCommand = {
      kind: 'surfaceExternalUrl',
      commandId: 'surface-url-drop.canvas',
      target: { type: 'canvas-drop-zone', canvasId: 'canvas-1' as never },
      embedTarget: {
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      },
      label: 'Drop URL on canvas',
    }

    expect(command.kind).toBe('surfaceExternalUrl')
  })

  it('models filesystem commands as plans rather than completed results', () => {
    type FileSystemCommand = Extract<PlannedDropCommand, { kind: 'filesystem' }>

    expectTypeOf<FileSystemCommand>().toHaveProperty('plan')
    expectTypeOf<FileSystemCommand>().not.toHaveProperty('result')
  })
})

describe('resolveDropCommand', () => {
  it('plans resource drops on an empty editor as opening the resource', () => {
    const note = createNote()

    expect(
      resolveDropCommand({
        payload: { kind: 'resources', items: [note] },
        target: { type: EMPTY_EDITOR_DROP_TYPE },
        ctx: planningContext(),
      }),
    ).toEqual({
      kind: 'openResource',
      item: note,
      label: 'Open item',
    })
  })

  it('plans resource drops on folders through the filesystem command path', () => {
    const note = createNote()
    const folder = createFolder({ name: 'Destination' })

    expect(
      resolveDropCommand({
        payload: { kind: 'resources', items: [note] },
        target: { ...folder, ancestorIds: [] },
        ctx: planningContext(),
      }),
    ).toMatchObject({
      kind: 'filesystem',
      plan: {
        label: 'Move item to "Destination"',
        command: {
          type: 'move',
          itemIds: [note.id],
          targetParentId: folder.id,
        },
      },
    })
  })

  it('plans resource drops on canvas through the surface command path', () => {
    const note = createNote()

    const command = resolveDropCommand({
      payload: { kind: 'resources', items: [note] },
      target: { type: CANVAS_DROP_ZONE_TYPE, canvasId: testResourceId('canvas_1') },
      ctx: planningContext(),
    })

    expect(command).toMatchObject({
      kind: 'surface',
      command: {
        status: 'ready',
        action: 'embed',
        items: [note],
      },
    })
    expect(command).not.toHaveProperty('label')
  })

  it('returns blocked commands for invalid resource drops instead of throwing', () => {
    expect(
      resolveDropCommand({
        payload: { kind: 'resources', items: [createNote()] },
        target: null,
        ctx: planningContext(),
      }),
    ).toEqual({ kind: 'blocked', reason: 'missing_data' })
  })

  it('plans external files without a target as root file imports', () => {
    const dropResult = testDropResult({ files: [{ name: 'handout.pdf' }] })

    expect(
      resolveDropCommand({
        payload: { kind: 'externalFiles', dropResult },
        target: null,
        ctx: planningContext(),
      }),
    ).toEqual({
      kind: 'fileImport',
      dropResult,
      destination: { kind: 'direct', parentId: null },
      label: 'Import files',
    })
  })

  it('plans external files on sidebar root as root file imports', () => {
    const dropResult = testDropResult({ files: [{ name: 'handout.pdf' }] })

    expect(
      resolveDropCommand({
        payload: { kind: 'externalFiles', dropResult },
        target: { type: SIDEBAR_ROOT_DROP_TYPE },
        ctx: planningContext(),
      }),
    ).toMatchObject({
      kind: 'fileImport',
      destination: { kind: 'direct', parentId: null },
    })
  })

  it('plans external files on folders as child file imports', () => {
    const dropResult = testDropResult({ files: [{ name: 'handout.pdf' }] })
    const folder = createFolder()

    expect(
      resolveDropCommand({
        payload: { kind: 'externalFiles', dropResult },
        target: { ...folder, ancestorIds: [] },
        ctx: planningContext(),
      }),
    ).toMatchObject({
      kind: 'fileImport',
      destination: { kind: 'direct', parentId: folder.id },
    })
  })

  it('plans external files on canvas as surface file imports', () => {
    const dropResult = testDropResult({ files: [{ name: 'token.png' }] })
    const target = { type: CANVAS_DROP_ZONE_TYPE, canvasId: testResourceId('canvas_1') }

    expect(
      resolveDropCommand({
        payload: { kind: 'externalFiles', dropResult },
        target,
        ctx: planningContext(),
      }),
    ).toEqual({
      kind: 'surfaceFileImport',
      commandId: 'surface-file-import.canvas',
      target,
      dropResult,
      label: 'Upload to canvas',
    })
  })

  it('blocks multi-file external drops on a single-resource empty embed', () => {
    const dropResult = testDropResult({ files: [{ name: 'first.png' }, { name: 'second.png' }] })

    expect(
      resolveDropCommand({
        payload: { kind: 'externalFiles', dropResult },
        target: {
          type: EMPTY_EMBED_DROP_TYPE,
          sourceItemId: testResourceId('canvas_1'),
          embedBlockId: 'embed-block-1',
        },
        ctx: planningContext(),
      }),
    ).toEqual({ kind: 'blocked', reason: 'unexpected_action' })
  })

  it('plans local files on note bodies as note embed file insertion', () => {
    const dropResult = testDropResult({ files: [{ name: 'portrait.png' }] })
    const target = {
      type: NOTE_EDITOR_DROP_TYPE,
      noteId: testResourceId('note_1'),
    }

    expect(
      resolveDropCommand({
        payload: { kind: 'externalFiles', dropResult },
        target,
        ctx: planningContext(),
      }),
    ).toEqual({
      kind: 'surfaceFileImport',
      commandId: 'surface-file-import.note-editor',
      target,
      dropResult,
      label: 'Add file embeds to note',
    })
  })

  it('imports folders dropped on note bodies into assets without inserting an embed', () => {
    const dropResult = testDropResult({ rootFolders: [{ name: 'Reference Pack' }] })

    expect(
      resolveDropCommand({
        payload: { kind: 'externalFiles', dropResult },
        target: {
          type: NOTE_EDITOR_DROP_TYPE,
          noteId: testResourceId('note_1'),
        },
        ctx: planningContext(),
      }),
    ).toMatchObject({
      kind: 'fileImport',
      destination: { kind: 'assets' },
    })
  })

  it('plans mixed canvas files and folders as an explicit sequence', () => {
    const dropResult = testDropResult({
      files: [{ name: 'token.png' }],
      rootFolders: [{ name: 'Assets' }],
    })

    expect(
      resolveDropCommand({
        payload: { kind: 'externalFiles', dropResult },
        target: { type: CANVAS_DROP_ZONE_TYPE, canvasId: testResourceId('canvas_1') },
        ctx: planningContext(),
      }),
    ).toMatchObject({
      kind: 'sequence',
      commands: [
        { kind: 'surfaceFileImport', dropResult: { files: dropResult.files, rootFolders: [] } },
        {
          kind: 'fileImport',
          dropResult: { files: [], rootFolders: dropResult.rootFolders },
          destination: { kind: 'assets' },
        },
      ],
    })
  })

  it('blocks external files dropped on trash', () => {
    expect(
      resolveDropCommand({
        payload: { kind: 'externalFiles', dropResult: testDropResult({ files: [{ name: 'x' }] }) },
        target: { type: TRASH_DROP_ZONE_TYPE },
        ctx: planningContext(),
      }),
    ).toEqual({ kind: 'blocked', reason: 'unsupported_target' })
  })

  it('plans external URLs on canvas through the surface URL command path', () => {
    const embedTarget = {
      kind: 'externalUrl' as const,
      url: 'https://example.com/file.pdf',
      name: 'file.pdf',
    }
    const target = { type: CANVAS_DROP_ZONE_TYPE, canvasId: testResourceId('canvas_1') }

    expect(
      resolveDropCommand({
        payload: { kind: 'externalUrl', target: embedTarget },
        target,
        ctx: planningContext(),
      }),
    ).toEqual({
      kind: 'surfaceExternalUrl',
      commandId: 'surface-url-drop.canvas',
      target,
      embedTarget,
      label: 'Drop URL on canvas',
    })
  })

  it('plans external URLs on empty embeds through the surface URL command path', () => {
    const embedTarget = {
      kind: 'externalUrl' as const,
      url: 'https://example.com/file.pdf',
      name: 'file.pdf',
    }
    const target = {
      type: EMPTY_EMBED_DROP_TYPE,
      sourceItemId: testResourceId('canvas_1'),
      embedBlockId: 'embed-block-1',
    }

    expect(
      resolveDropCommand({
        payload: { kind: 'externalUrl', target: embedTarget },
        target,
        ctx: planningContext(),
      }),
    ).toEqual({
      kind: 'surfaceExternalUrl',
      commandId: 'surface-url-drop.empty-embed',
      target,
      embedTarget,
      label: 'Drop URL on embed',
    })
  })

  it('plans external URLs on note bodies as note embed insertion', () => {
    const embedTarget = {
      kind: 'externalUrl' as const,
      url: 'https://example.com/image.png',
      name: 'image.png',
    }
    const target = {
      type: NOTE_EDITOR_DROP_TYPE,
      noteId: testResourceId('note_1'),
    }

    expect(
      resolveDropCommand({
        payload: { kind: 'externalUrl', target: embedTarget },
        target,
        ctx: planningContext(),
      }),
    ).toEqual({
      kind: 'surfaceExternalUrl',
      commandId: 'surface-url-drop.note-editor',
      target,
      embedTarget,
      label: 'Drop URL in note',
    })
  })

  it('blocks external URLs dropped on unsupported targets', () => {
    expect(
      resolveDropCommand({
        payload: {
          kind: 'externalUrl',
          target: {
            kind: 'externalUrl',
            url: 'https://example.com/file.pdf',
            name: 'file.pdf',
          },
        },
        target: { type: SIDEBAR_ROOT_DROP_TYPE },
        ctx: planningContext(),
      }),
    ).toEqual({ kind: 'blocked', reason: 'unsupported_target' })
  })

  it('preserves rejected external URL classifications as blocked commands', () => {
    expect(
      resolveDropCommand({
        payload: { kind: 'rejectedExternalUrl', reason: 'missing_data' },
        target: { type: NOTE_EDITOR_DROP_TYPE, noteId: testResourceId('note_1') },
        ctx: planningContext(),
      }),
    ).toEqual({ kind: 'blocked', reason: 'missing_data' })
  })
})
