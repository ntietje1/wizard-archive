import { describe, expect, it, vi } from 'vitest'
import { NOTE_EDITOR_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import {
  executeRegisteredSurfaceDropCommand,
  registerSurfaceDropExecutor,
} from '~/features/dnd/utils/surface-drop-command'
import { resolveSurfaceDropCommand } from '~/features/dnd/utils/surface-drop-planner'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

describe('surface drop executors', () => {
  it('executes registered surface executors by command id and target key', async () => {
    const active = createNote()
    const target = { type: NOTE_EDITOR_DROP_TYPE, noteId: testId<'sidebarItems'>('note_target') }
    const input = { clientX: 12, clientY: 34 }
    const execute = vi.fn(() => Promise.resolve())
    const dispose = registerSurfaceDropExecutor({
      action: 'link',
      target,
      execute,
    })

    try {
      const command = resolveSurfaceDropCommand([active], target, {
        campaignId: active.campaignId,
      })

      await expect(
        executeRegisteredSurfaceDropCommand({
          command,
          input,
          setBatchDecision: vi.fn(),
        }),
      ).resolves.toBe(true)

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

  it('routes partial registered surface commands through the batch decision', async () => {
    const active = createNote({ name: 'Active' })
    const trashed = createNote({ name: 'Trashed', status: 'trashed' })
    const target = { type: NOTE_EDITOR_DROP_TYPE, noteId: testId<'sidebarItems'>('note_target') }
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
        campaignId: active.campaignId,
      })

      await expect(
        executeRegisteredSurfaceDropCommand({
          command,
          input,
          setBatchDecision,
        }),
      ).resolves.toBe(true)

      expect(execute).not.toHaveBeenCalled()
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

  it('unregisters surface executors without leaving stale handlers', async () => {
    const active = createNote()
    const target = { type: NOTE_EDITOR_DROP_TYPE, noteId: testId<'sidebarItems'>('note_target') }
    const execute = vi.fn(() => Promise.resolve())
    const dispose = registerSurfaceDropExecutor({
      action: 'link',
      target,
      execute,
    })
    dispose()

    const command = resolveSurfaceDropCommand([active], target, {
      campaignId: active.campaignId,
    })

    await expect(
      executeRegisteredSurfaceDropCommand({
        command,
        input: { clientX: 0, clientY: 0 },
        setBatchDecision: vi.fn(),
      }),
    ).resolves.toBe(false)
    expect(execute).not.toHaveBeenCalled()
  })

  it('does not open a batch decision dialog when every surface item is rejected', async () => {
    const rejected = createNote({ status: 'trashed' })
    const setBatchDecision = vi.fn()
    const execute = vi.fn()
    const target = { type: NOTE_EDITOR_DROP_TYPE, noteId: testId<'sidebarItems'>('note_target') }
    const dispose = registerSurfaceDropExecutor({
      action: 'link',
      target,
      execute,
    })

    try {
      await expect(
        executeRegisteredSurfaceDropCommand({
          command: {
            status: 'failed',
            commandId: 'surface-drop.link-sidebar-item-in-note',
            action: 'link',
            target,
            items: [],
            rejectedItems: [{ item: rejected, reason: 'trashed_item' }],
            label: 'Item cannot be linked',
          },
          input: { clientX: 0, clientY: 0 },
          setBatchDecision,
        }),
      ).resolves.toBe(true)
    } finally {
      dispose()
    }

    expect(setBatchDecision).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })
})
