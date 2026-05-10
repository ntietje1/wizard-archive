import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DndBatchDecisionDialog } from '../dnd-batch-decision-dialog'
import {
  CANVAS_DROP_ZONE_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
} from '~/features/dnd/utils/drop-target-data'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { createGameMap, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

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
        action: 'pin',
        items: [createNote()],
        rejectedItems: [{ item: targetMap, reason: 'self_pin' }],
        target: {
          type: MAP_DROP_ZONE_TYPE,
          mapId: targetMap._id,
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
    expect(screen.queryByText('Cannot Pin This Map')).not.toBeInTheDocument()
  })

  it('uses the batch summary as the title for mixed failure types', () => {
    const targetNote = createNote()

    useDndStore.getState().setBatchDecision({
      command: {
        status: 'partial',
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
    expect(screen.queryByText('Some Note Links Cannot Be Added')).not.toBeInTheDocument()
  })

  it('uses the blocked batch summary as the title when no items can be included', () => {
    useDndStore.getState().setBatchDecision({
      command: {
        status: 'failed',
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

  it('uses compact buttons, operation-specific summary text, and invalid reason styling', async () => {
    const onConfirm = vi.fn()

    useDndStore.getState().setBatchDecision({
      command: {
        status: 'partial',
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
    expect(screen.getByText('Already pinned to this map')).toHaveClass('text-amber-600')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    expect(screen.getByText('Continue')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Continue pinning items' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes without confirming when cancelled', async () => {
    const onConfirm = vi.fn()

    useDndStore.getState().setBatchDecision({
      command: {
        status: 'partial',
        action: 'link',
        items: [createNote()],
        rejectedItems: [{ item: createNote(), reason: 'self_link' }],
        target: {
          type: NOTE_EDITOR_DROP_TYPE,
          noteId: testId<'sidebarItems'>('note_target'),
        },
        label: 'Add link here',
      },
      onConfirm,
    })

    render(<DndBatchDecisionDialog />)

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
