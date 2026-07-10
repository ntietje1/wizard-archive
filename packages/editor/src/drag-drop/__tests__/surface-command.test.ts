import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NOTE_EDITOR_DROP_TYPE } from '../drop-target-data'
import {
  executeRegisteredSurfaceDropCommand,
  registerSurfaceDropExecutor,
} from '../surface-command'
import { resolveSurfaceDropCommand } from '../surface-planner'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../workspace/items-persistence-contract'
import type { AnyItem } from '../../workspace/items'
import type { ResourceStatus } from '../../workspace/resource-contract'
import type { CampaignId, SidebarItemId } from '../../../../../shared/common/ids'
import type { SurfaceDropCommandEffects } from '../surface-command-effects'

const campaignId = 'campaign_1' as CampaignId

function sidebarItemId(value: string) {
  return value as SidebarItemId
}

function createNote(
  overrides: { name?: string; status?: ResourceStatus } & Omit<
    Partial<AnyItem>,
    'name' | 'status'
  > = {},
): AnyItem {
  return {
    id: sidebarItemId(`note_${Math.random().toString(36).slice(2)}`),
    campaignId,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    type: RESOURCE_TYPES.notes,
    name: 'Test Note',
    ...overrides,
  } as AnyItem
}

describe('surface drop executors', () => {
  function createTestEffects(): SurfaceDropCommandEffects {
    return {
      reportError: vi.fn(),
      reportRejection: vi.fn(),
      reportRejections: vi.fn(),
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('executes registered surface executors by command id and target key', async () => {
    const active = createNote()
    const target = { type: NOTE_EDITOR_DROP_TYPE, noteId: sidebarItemId('note_target') }
    const input = { clientX: 12, clientY: 34 }
    const execute = vi.fn(() => Promise.resolve())
    const dispose = registerSurfaceDropExecutor({
      action: 'link',
      target,
      execute,
    })

    try {
      const command = resolveSurfaceDropCommand([active], target, {
        workspaceId: active.campaignId,
      })

      await expect(
        executeRegisteredSurfaceDropCommand({
          command,
          input,
          setBatchDecision: vi.fn(),
        }),
      ).resolves.toBeUndefined()

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          commandId: 'surface-drop.link-sidebar-item-in-note',
          action: 'link',
          items: [active],
        }),
        input,
      )
    } finally {
      dispose()
    }
  })

  it('keeps surface executors isolated by runtime instance id', async () => {
    const active = createNote()
    const runtimeATarget = {
      type: NOTE_EDITOR_DROP_TYPE,
      noteId: sidebarItemId('note_target'),
      __wizardArchiveDndRuntimeId: 'runtime-a',
    }
    const runtimeBTarget = {
      type: NOTE_EDITOR_DROP_TYPE,
      noteId: sidebarItemId('note_target'),
      __wizardArchiveDndRuntimeId: 'runtime-b',
    }
    const executeA = vi.fn(() => Promise.resolve())
    const executeB = vi.fn(() => Promise.resolve())
    const disposeA = registerSurfaceDropExecutor({
      action: 'link',
      target: runtimeATarget,
      execute: executeA,
    })
    const disposeB = registerSurfaceDropExecutor({
      action: 'link',
      target: runtimeBTarget,
      execute: executeB,
    })

    try {
      const command = resolveSurfaceDropCommand([active], runtimeATarget, {
        workspaceId: active.campaignId,
      })

      await expect(
        executeRegisteredSurfaceDropCommand({
          command,
          input: { clientX: 12, clientY: 34 },
          setBatchDecision: vi.fn(),
        }),
      ).resolves.toBeUndefined()

      expect(executeA).toHaveBeenCalledOnce()
      expect(executeB).not.toHaveBeenCalled()
    } finally {
      disposeA()
      disposeB()
    }
  })

  it('routes partial registered surface commands through the batch decision', async () => {
    const active = createNote({ name: 'Active' })
    const trashed = createNote({ name: 'Trashed', status: 'trashed' })
    const target = { type: NOTE_EDITOR_DROP_TYPE, noteId: sidebarItemId('note_target') }
    const input = { clientX: 12, clientY: 34 }
    const execute = vi.fn(() => Promise.resolve())
    const setBatchDecision = vi.fn()
    const dispose = registerSurfaceDropExecutor({
      action: 'link',
      target,
      execute,
    })

    try {
      const command = resolveSurfaceDropCommand([active, trashed], target, {
        workspaceId: active.campaignId,
      })

      await expect(
        executeRegisteredSurfaceDropCommand({
          command,
          input,
          setBatchDecision,
        }),
      ).resolves.toBeUndefined()

      expect(setBatchDecision).toHaveBeenCalledWith({
        command: expect.objectContaining({
          status: 'partial',
          commandId: 'surface-drop.link-sidebar-item-in-note',
          action: 'link',
          items: [active],
          rejectedItems: [{ item: trashed, reason: 'trashed_item' }],
        }),
        onConfirm: expect.any(Function),
      })
      expect(execute).not.toHaveBeenCalled()

      const decision = setBatchDecision.mock.calls[0]?.[0]
      await decision.onConfirm()
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'partial',
          commandId: 'surface-drop.link-sidebar-item-in-note',
          action: 'link',
          items: [active],
        }),
        input,
      )
    } finally {
      dispose()
    }
  })

  it('reports ready surface commands whose executor is no longer registered', async () => {
    const active = createNote()
    const target = { type: NOTE_EDITOR_DROP_TYPE, noteId: sidebarItemId('note_target') }
    const dispose = registerSurfaceDropExecutor({
      action: 'link',
      target,
      execute: () => Promise.reject(new Error('disposed executor was invoked')),
    })
    dispose()

    const command = resolveSurfaceDropCommand([active], target, {
      workspaceId: active.campaignId,
    })
    const effects = createTestEffects()

    expect(command).toMatchObject({
      status: 'ready',
      commandId: 'surface-drop.link-sidebar-item-in-note',
      action: 'link',
      items: [active],
      target,
    })
    await expect(
      executeRegisteredSurfaceDropCommand({
        command,
        input: { clientX: 0, clientY: 0 },
        setBatchDecision: vi.fn(),
        effects,
      }),
    ).resolves.toBeUndefined()
    expect(effects.reportError).toHaveBeenCalledWith(expect.any(Error), 'Cannot drop items here')
  })

  it('reports blocked surface commands with the rejection message', async () => {
    const targetNote = createNote()
    const target = { type: NOTE_EDITOR_DROP_TYPE, noteId: targetNote.id }
    const command = resolveSurfaceDropCommand([targetNote], target, {
      workspaceId: targetNote.campaignId,
    })
    const effects = createTestEffects()

    await expect(
      executeRegisteredSurfaceDropCommand({
        command,
        input: { clientX: 0, clientY: 0 },
        setBatchDecision: vi.fn(),
        effects,
      }),
    ).resolves.toBeUndefined()

    expect(effects.reportRejection).toHaveBeenCalledWith('self_link')
    expect(effects.reportError).not.toHaveBeenCalled()
  })

  it('reports failed batch surface commands with rejection details', async () => {
    const targetNote = createNote()
    const rejected = createNote({ status: 'trashed' })
    const setBatchDecision = vi.fn()
    const target = { type: NOTE_EDITOR_DROP_TYPE, noteId: targetNote.id }
    const command = resolveSurfaceDropCommand([targetNote, rejected], target, {
      workspaceId: targetNote.campaignId,
    })
    const effects = createTestEffects()

    expect(command).toMatchObject({
      status: 'failed',
      commandId: 'surface-drop.link-sidebar-item-in-note',
      action: 'link',
      items: [],
      rejectedItems: [
        { item: targetNote, reason: 'self_link' },
        { item: rejected, reason: 'trashed_item' },
      ],
      target,
    })
    await expect(
      executeRegisteredSurfaceDropCommand({
        command,
        input: { clientX: 0, clientY: 0 },
        setBatchDecision,
        effects,
      }),
    ).resolves.toBeUndefined()

    expect(effects.reportRejections).toHaveBeenCalledWith(['self_link', 'trashed_item'])
    expect(effects.reportError).not.toHaveBeenCalled()
  })

  it('reports partial confirm failures through the command effects', async () => {
    const active = createNote({ name: 'Active' })
    const trashed = createNote({ name: 'Trashed', status: 'trashed' })
    const target = { type: NOTE_EDITOR_DROP_TYPE, noteId: sidebarItemId('note_target') }
    const error = new Error('drop failed')
    const execute = vi.fn(() => Promise.reject(error))
    const setBatchDecision = vi.fn()
    const effects = createTestEffects()
    const dispose = registerSurfaceDropExecutor({
      action: 'link',
      target,
      execute,
    })

    try {
      const command = resolveSurfaceDropCommand([active, trashed], target, {
        workspaceId: active.campaignId,
      })

      await executeRegisteredSurfaceDropCommand({
        command,
        input: { clientX: 12, clientY: 34 },
        setBatchDecision,
        effects,
      })

      const decision = setBatchDecision.mock.calls[0]?.[0]
      await expect(decision.onConfirm()).resolves.toBeUndefined()
      expect(effects.reportError).toHaveBeenCalledWith(error, 'Failed to add links')
    } finally {
      dispose()
    }
  })
})
