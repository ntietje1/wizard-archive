import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { DndBatchDecisionDialog } from '../batch-decision-dialog'
import {
  CANVAS_DROP_ZONE_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
} from '../drop-target-data'
import { defaultDndStoreApi as useDndStore } from '../store'
import { createGameMap, createNote } from '../../test/sidebar-item-factory'
import { testId } from '../../test/id'

function createDeferredConfirm() {
  let resolveConfirm!: () => void
  const promise = new Promise<void>((resolve) => {
    resolveConfirm = resolve
  })
  return {
    promise,
    resolve: () => resolveConfirm(),
  }
}

describe('DndBatchDecisionDialog', () => {
  afterEach(() => {
    useDndStore.getState().setBatchDecision(null)
    cleanup()
  })

  it('uses the batch summary as the title for one failure type', () => {
    const targetMap = createGameMap()

    useDndStore.getState().setBatchDecision({
      command: {
        status: 'partial',
        commandId: 'surface-drop.pin-sidebar-item-to-map',
        action: 'pin',
        items: [createNote()],
        rejectedItems: [{ item: targetMap, reason: 'self_pin' }],
        target: {
          type: MAP_DROP_ZONE_TYPE,
          mapId: targetMap.id,
          mapName: targetMap.name,
          pinnedItemIds: [],
        },
        label: `Pin to "${targetMap.name}"`,
      },
      onConfirm: vi.fn(),
    })

    render(<DndBatchDecisionDialog />)

    expect(
      screen.getByRole('heading', { name: '1 item can be pinned and 1 item cannot' }),
    ).toBeInTheDocument()
  })

  it('uses the batch summary as the title for mixed failure types', () => {
    const targetNote = createNote()

    useDndStore.getState().setBatchDecision({
      command: {
        status: 'partial',
        commandId: 'surface-drop.link-sidebar-item-in-note',
        action: 'link',
        items: [createNote()],
        rejectedItems: [
          { item: targetNote, reason: 'self_link' },
          { item: createNote(), reason: 'trashed_item' },
        ],
        target: {
          type: NOTE_EDITOR_DROP_TYPE,
          noteId: testId<'sidebarItems'>('note_target'),
        },
        label: 'Add link here',
      },
      onConfirm: vi.fn(),
    })

    render(<DndBatchDecisionDialog />)

    expect(
      screen.getByRole('heading', { name: '1 item can be linked and 2 items cannot' }),
    ).toBeInTheDocument()
  })

  it('uses the blocked batch summary as the title when no items can be included', () => {
    useDndStore.getState().setBatchDecision({
      command: {
        status: 'failed',
        commandId: 'surface-drop.embed-sidebar-item-in-canvas',
        action: 'embed',
        items: [],
        rejectedItems: [
          { item: createNote(), reason: 'self_embed' },
          { item: createNote(), reason: 'trashed_item' },
        ],
        target: {
          type: CANVAS_DROP_ZONE_TYPE,
          canvasId: testId<'sidebarItems'>('canvas_target'),
        },
        label: 'Embed items in canvas',
      },
      onConfirm: vi.fn(),
    })

    render(<DndBatchDecisionDialog />)

    expect(
      screen.getByRole('heading', { name: 'No items can be embedded here' }),
    ).toBeInTheDocument()
  })

  it('uses compact buttons and operation-specific summary text', async () => {
    const onConfirm = vi.fn()

    useDndStore.getState().setBatchDecision({
      command: {
        status: 'partial',
        commandId: 'surface-drop.pin-sidebar-item-to-map',
        action: 'pin',
        items: [createNote(), createNote()],
        rejectedItems: [{ item: createGameMap(), reason: 'already_pinned' }],
        target: {
          type: MAP_DROP_ZONE_TYPE,
          mapId: testId<'sidebarItems'>('map_target'),
          mapName: 'World Map',
          pinnedItemIds: [],
        },
        label: 'Pin items to "World Map"',
      },
      onConfirm,
    })

    render(<DndBatchDecisionDialog />)

    expect(
      screen.getByRole('heading', { name: '2 items can be pinned and 1 item cannot' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Already pinned to this map')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    expect(screen.getByText('Continue')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Continue pinning items' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps a newer batch decision when an older confirm finishes', async () => {
    const pendingConfirm = createDeferredConfirm()
    const firstTargetMap = createGameMap({ name: 'First Map' })
    const secondTargetMap = createGameMap({ name: 'Second Map' })

    useDndStore.getState().setBatchDecision({
      command: {
        status: 'partial',
        commandId: 'surface-drop.pin-sidebar-item-to-map',
        action: 'pin',
        items: [createNote()],
        rejectedItems: [{ item: firstTargetMap, reason: 'already_pinned' }],
        target: {
          type: MAP_DROP_ZONE_TYPE,
          mapId: firstTargetMap.id,
          mapName: firstTargetMap.name,
          pinnedItemIds: [],
        },
        label: `Pin items to "${firstTargetMap.name}"`,
      },
      onConfirm: vi.fn(() => pendingConfirm.promise),
    })

    render(<DndBatchDecisionDialog />)

    await userEvent.click(screen.getByRole('button', { name: 'Continue pinning items' }))

    act(() => {
      useDndStore.getState().setBatchDecision({
        command: {
          status: 'partial',
          commandId: 'surface-drop.pin-sidebar-item-to-map',
          action: 'pin',
          items: [createNote(), createNote()],
          rejectedItems: [{ item: secondTargetMap, reason: 'already_pinned' }],
          target: {
            type: MAP_DROP_ZONE_TYPE,
            mapId: secondTargetMap.id,
            mapName: secondTargetMap.name,
            pinnedItemIds: [],
          },
          label: `Pin items to "${secondTargetMap.name}"`,
        },
        onConfirm: vi.fn(),
      })
    })

    expect(
      screen.getByRole('heading', { name: '2 items can be pinned and 1 item cannot' }),
    ).toBeInTheDocument()

    await act(async () => {
      pendingConfirm.resolve()
      await pendingConfirm.promise
    })

    expect(
      screen.getByRole('heading', { name: '2 items can be pinned and 1 item cannot' }),
    ).toBeInTheDocument()
  })

  it('keeps the current batch decision open when confirm fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const targetMap = createGameMap({ name: 'World Map' })
    const onConfirm = vi.fn(() => Promise.reject(new Error('drop failed')))

    try {
      useDndStore.getState().setBatchDecision({
        command: {
          status: 'partial',
          commandId: 'surface-drop.pin-sidebar-item-to-map',
          action: 'pin',
          items: [createNote()],
          rejectedItems: [{ item: targetMap, reason: 'already_pinned' }],
          target: {
            type: MAP_DROP_ZONE_TYPE,
            mapId: targetMap.id,
            mapName: targetMap.name,
            pinnedItemIds: [],
          },
          label: `Pin items to "${targetMap.name}"`,
        },
        onConfirm,
      })

      render(<DndBatchDecisionDialog />)

      await userEvent.click(screen.getByRole('button', { name: 'Continue pinning items' }))

      expect(onConfirm).toHaveBeenCalledOnce()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Continue pinning items' })).toBeEnabled()
      expect(useDndStore.getState().batchDecision).not.toBeNull()
    } finally {
      consoleError.mockRestore()
    }
  })
})
