import { describe, expect, it, vi } from 'vite-plus/test'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../workspace/items-persistence-contract'
import type { AnyItem } from '../../workspace/items'
import type { CampaignId, SidebarItemId } from '../../../../../shared/common/ids'
import type { DropResult } from '../file-drop'
import type { PlannedDropCommand } from '../drop-command'
import {
  executePlannedDropCommand,
  registerSurfaceFileImportExecutor,
  registerSurfaceExternalUrlDropExecutor,
} from '../drop-command-execution'
import { CANVAS_DROP_ZONE_TYPE } from '../drop-target-data'

const campaignId = 'campaign_1' as CampaignId

function sidebarItemId(value: string) {
  return value as SidebarItemId
}

function createNote(overrides: Partial<AnyItem> = {}): AnyItem {
  return {
    id: sidebarItemId('note_1'),
    campaignId,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    type: RESOURCE_TYPES.notes,
    name: 'Note',
    ...overrides,
  } as AnyItem
}

function createDropResult(): DropResult {
  return {
    files: [{ file: new File(['content'], 'portrait.png'), relativePath: 'portrait.png' }],
    rootFolders: [],
  }
}

function createExecutionContext() {
  return {
    executeFileSystemCommand: vi.fn(),
    handleDropFiles: vi.fn(),
    openItem: vi.fn(),
    setBatchDecision: vi.fn(),
    surfaceEffects: {
      reportError: vi.fn(),
      reportRejection: vi.fn(),
      reportRejections: vi.fn(),
    },
  }
}

describe('executePlannedDropCommand', () => {
  it('reports blocked commands through the execution effects', async () => {
    const ctx = createExecutionContext()

    await expect(
      executePlannedDropCommand(
        { kind: 'blocked', reason: 'unsupported_target' },
        { clientX: 0, clientY: 0 },
        ctx,
      ),
    ).resolves.toBeUndefined()

    expect(ctx.surfaceEffects.reportRejection).toHaveBeenCalledWith('unsupported_target')
  })

  it('returns filesystem resource command results without drop receipts', async () => {
    const item = createNote()
    const ctx = createExecutionContext()
    const resourceResult = { status: 'completed', receipt: null }
    ctx.executeFileSystemCommand.mockResolvedValue(resourceResult)

    await expect(
      executePlannedDropCommand(
        {
          kind: 'filesystem',
          plan: {
            command: { type: 'move', itemIds: [item.id], targetParentId: null },
            label: 'Move item to "Root"',
          },
        },
        { clientX: 0, clientY: 0 },
        ctx,
      ),
    ).resolves.toBe(resourceResult)

    expect(ctx.executeFileSystemCommand).toHaveBeenCalledWith({
      type: 'move',
      itemIds: [item.id],
      targetParentId: null,
    })
  })

  it('returns rejected filesystem resource command results directly', async () => {
    const item = createNote()
    const ctx = createExecutionContext()
    const resourceResult = { status: 'rejected', reason: 'stale-conflict' }
    ctx.executeFileSystemCommand.mockResolvedValue(resourceResult)

    await expect(
      executePlannedDropCommand(
        {
          kind: 'filesystem',
          plan: {
            command: { type: 'trash', itemIds: [item.id] },
            label: 'Move item to "Trash"',
          },
        },
        { clientX: 0, clientY: 0 },
        ctx,
      ),
    ).resolves.toBe(resourceResult)
  })

  it('opens resource commands as interaction side effects', async () => {
    const item = createNote()
    const ctx = createExecutionContext()
    ctx.openItem.mockResolvedValue(undefined)

    await expect(
      executePlannedDropCommand(
        { kind: 'openResource', item, label: 'Open item' },
        { clientX: 0, clientY: 0 },
        ctx,
      ),
    ).resolves.toBeUndefined()

    expect(ctx.openItem).toHaveBeenCalledWith(item)
  })

  it('runs generic external file imports as interaction side effects', async () => {
    const dropResult = createDropResult()
    const ctx = createExecutionContext()
    const receipt = { imported: 1 }
    ctx.handleDropFiles.mockResolvedValue({ status: 'completed', receipt })

    await expect(
      executePlannedDropCommand(
        {
          kind: 'fileImport',
          dropResult,
          destination: { kind: 'direct', parentId: null },
          label: 'Import files',
        },
        { clientX: 0, clientY: 0 },
        ctx,
      ),
    ).resolves.toBeUndefined()

    expect(ctx.handleDropFiles).toHaveBeenCalledWith(dropResult, {
      destination: { kind: 'direct', parentId: null },
    })
  })

  it('runs registered surface file import commands as interaction side effects', async () => {
    const dropResult = createDropResult()
    const target = { type: CANVAS_DROP_ZONE_TYPE, canvasId: sidebarItemId('canvas_1') }
    const execute = vi.fn().mockResolvedValue({ uploaded: 1 })
    const dispose = registerSurfaceFileImportExecutor({
      commandId: 'surface-file-import.canvas',
      target,
      execute,
    })
    const ctx = createExecutionContext()

    try {
      const command: PlannedDropCommand = {
        kind: 'surfaceFileImport',
        commandId: 'surface-file-import.canvas',
        target,
        dropResult,
        label: 'Upload to canvas',
      }

      await expect(
        executePlannedDropCommand(command, { clientX: 12, clientY: 34 }, ctx),
      ).resolves.toBeUndefined()

      expect(execute).toHaveBeenCalledWith(command, { clientX: 12, clientY: 34 })
      expect(ctx.handleDropFiles).not.toHaveBeenCalled()
    } finally {
      dispose()
    }
  })

  it('runs registered surface URL commands as interaction side effects', async () => {
    const target = { type: CANVAS_DROP_ZONE_TYPE, canvasId: sidebarItemId('canvas_1') }
    const execute = vi.fn().mockResolvedValue(undefined)
    const dispose = registerSurfaceExternalUrlDropExecutor({
      commandId: 'surface-url-drop.canvas',
      target,
      execute,
    })
    const ctx = createExecutionContext()

    try {
      const command: PlannedDropCommand = {
        kind: 'surfaceExternalUrl',
        commandId: 'surface-url-drop.canvas',
        target,
        embedTarget: {
          kind: 'externalUrl',
          url: 'https://example.com/file.pdf',
          name: 'file.pdf',
        },
        label: 'Drop URL on canvas',
      }

      await expect(
        executePlannedDropCommand(command, { clientX: 12, clientY: 34 }, ctx),
      ).resolves.toBeUndefined()

      expect(execute).toHaveBeenCalledWith(command, { clientX: 12, clientY: 34 })
      expect(ctx.handleDropFiles).not.toHaveBeenCalled()
    } finally {
      dispose()
    }
  })

  it('fails missing surface URL executors without generic fallback', async () => {
    const ctx = createExecutionContext()

    await expect(
      executePlannedDropCommand(
        {
          kind: 'surfaceExternalUrl',
          commandId: 'surface-url-drop.canvas',
          target: { type: CANVAS_DROP_ZONE_TYPE, canvasId: sidebarItemId('canvas_1') },
          embedTarget: {
            kind: 'externalUrl',
            url: 'https://example.com/file.pdf',
            name: 'file.pdf',
          },
          label: 'Drop URL on canvas',
        },
        { clientX: 0, clientY: 0 },
        ctx,
      ),
    ).rejects.toThrow('Missing surface URL drop executor')

    expect(ctx.handleDropFiles).not.toHaveBeenCalled()
  })

  it('fails missing surface file import executors without generic fallback', async () => {
    const ctx = createExecutionContext()
    const dropResult = createDropResult()

    await expect(
      executePlannedDropCommand(
        {
          kind: 'surfaceFileImport',
          commandId: 'surface-file-import.canvas',
          target: { type: CANVAS_DROP_ZONE_TYPE, canvasId: sidebarItemId('canvas_1') },
          dropResult,
          label: 'Upload to canvas',
        },
        { clientX: 0, clientY: 0 },
        ctx,
      ),
    ).rejects.toThrow('Missing surface file import executor')

    expect(ctx.handleDropFiles).not.toHaveBeenCalled()
  })

  it('executes explicit sequences through each interaction side effect', async () => {
    const surfaceDropResult = createDropResult()
    const folderDropResult: DropResult = {
      files: [],
      rootFolders: [{ name: 'Maps', relativePath: 'Maps', files: [], subfolders: [] }],
    }
    const target = { type: CANVAS_DROP_ZONE_TYPE, canvasId: sidebarItemId('canvas_1') }
    const dispose = registerSurfaceFileImportExecutor({
      commandId: 'surface-file-import.canvas',
      target,
      execute: vi.fn().mockResolvedValue({ uploaded: 1 }),
    })
    const ctx = createExecutionContext()
    ctx.handleDropFiles.mockResolvedValue({ status: 'completed', receipt: { imported: 1 } })

    try {
      await expect(
        executePlannedDropCommand(
          {
            kind: 'sequence',
            commands: [
              {
                kind: 'surfaceFileImport',
                commandId: 'surface-file-import.canvas',
                target,
                dropResult: surfaceDropResult,
                label: 'Upload to canvas',
              },
              {
                kind: 'fileImport',
                dropResult: folderDropResult,
                destination: { kind: 'assets' },
                label: 'Import files',
              },
            ],
          },
          { clientX: 0, clientY: 0 },
          ctx,
        ),
      ).resolves.toBeUndefined()
    } finally {
      dispose()
    }
  })
})
