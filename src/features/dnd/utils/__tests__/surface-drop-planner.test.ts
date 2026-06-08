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

    expect(command).toMatchObject({
      status: 'ready',
      commandId: 'surface-drop.pin-sidebar-item-to-map',
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
      commandId: 'surface-drop.link-sidebar-item-in-note',
      action: 'link',
      items: [],
      rejectedItems: [{ item: targetNote, reason: 'self_link' }],
      label: 'This item cannot be linked here',
    })
    if (command.status === 'failed') expect(command.action).toBe('link')
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
      commandId: 'surface-drop.link-sidebar-item-in-note',
      action: 'link',
      items: [],
      rejectedItems: [{ item: targetNote, reason: 'self_link' }],
      label: 'This item cannot be linked here',
    })
  })

  it('routes note editor drops to embed creation when requested by modifier state', () => {
    const note = createNote()
    const targetNote = createNote()

    const command = resolveSurfaceDropCommand(
      [note],
      { type: NOTE_EDITOR_DROP_TYPE, noteId: targetNote._id },
      planningContext(),
      { noteEditorDropAction: 'embed' },
    )

    expect(command).toMatchObject({
      status: 'ready',
      commandId: 'surface-drop.embed-sidebar-item-in-note',
      action: 'noteEmbed',
      items: [note],
      rejectedItems: [],
      label: 'Embed item here',
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
      commandId: 'surface-drop.pin-sidebar-item-to-map',
      action: 'pin',
      rejectedItems: [{ item: note, reason: 'wrong_campaign' }],
    })
  })
})
