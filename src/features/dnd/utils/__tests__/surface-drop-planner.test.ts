import { describe, expect, it } from 'vitest'
import type { SurfaceDropPlanningContext } from '~/features/dnd/utils/drop-planning-context'
import { MAP_DROP_ZONE_TYPE, NOTE_EDITOR_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import { resolveSurfaceDropCommand } from '~/features/dnd/utils/surface-drop-planner'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

function planningContext(
  overrides?: Partial<SurfaceDropPlanningContext>,
): SurfaceDropPlanningContext {
  return {
    campaignId: testId<'campaigns'>('campaign_1'),
    ...overrides,
  }
}

describe('resolveSurfaceDropCommand', () => {
  it('plans surface drops from planning context without executable DnD operations', () => {
    const first = createNote()
    const second = createNote()
    const target = {
      type: MAP_DROP_ZONE_TYPE,
      mapId: testId<'sidebarItems'>('map_99'),
      mapName: 'World Map',
      pinnedItemIds: [],
    }

    const command = resolveSurfaceDropCommand([first, second], target, planningContext())

    expect(command).not.toHaveProperty('moveItems')
    expect(command).not.toHaveProperty('restoreItems')
    expect(command).not.toHaveProperty('trashItems')
    expect(command).toMatchObject({
      status: 'ready',
      action: 'pin',
      items: [first, second],
      rejectedItems: [],
      target,
      label: 'Pin 2 items to "World Map"',
    })
  })

  it('returns failed surface commands with rejection details when every item is invalid', () => {
    const targetNote = createNote()

    const command = resolveSurfaceDropCommand(
      [targetNote],
      { type: NOTE_EDITOR_DROP_TYPE, noteId: targetNote._id },
      planningContext(),
    )

    expect(command).toMatchObject({
      status: 'failed',
      action: 'link',
      items: [],
      rejectedItems: [{ item: targetNote, reason: 'self_link' }],
      label: 'No items can be linked here',
    })
    if (command.status === 'failed') {
      expect(command.rejectedItems).toHaveLength(1)
      expect(command.items).toHaveLength(0)
    }
  })

  it('returns failed surface commands without accepted operation labels', () => {
    const targetNote = createNote()

    expect(
      resolveSurfaceDropCommand(
        [targetNote],
        { type: NOTE_EDITOR_DROP_TYPE, noteId: targetNote._id },
        planningContext(),
      ),
    ).toMatchObject({
      status: 'failed',
      action: 'link',
      items: [],
      rejectedItems: [{ item: targetNote, reason: 'self_link' }],
      label: 'No items can be linked here',
    })
  })

  it('rejects wrong-campaign items using planning context campaign id', () => {
    const note = createNote({ campaignId: testId<'campaigns'>('other_campaign') })

    expect(
      resolveSurfaceDropCommand(
        [note],
        {
          type: MAP_DROP_ZONE_TYPE,
          mapId: testId<'sidebarItems'>('map_99'),
          mapName: 'World Map',
          pinnedItemIds: [],
        },
        planningContext(),
      ),
    ).toMatchObject({
      status: 'failed',
      action: 'pin',
      rejectedItems: [{ item: note, reason: 'wrong_campaign' }],
    })
  })
})
