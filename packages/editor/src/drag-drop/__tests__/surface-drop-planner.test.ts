import { testResourceId } from '../../../../../shared/test/resource-id'
import { describe, expect, it } from 'vite-plus/test'
import type { SurfaceDropPlanningContext } from '../planning-context'
import {
  EMPTY_EMBED_DROP_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
} from '../drop-target-data'
import { resolveSurfaceDropCommand } from '../surface-planner'
import { createNote as createNoteFixture } from '../../test/sidebar-item-factory'
import { testCampaignId } from '../../../../../shared/test/campaign-id'

const campaignId = testCampaignId('campaign_1')

function createNote(overrides: Parameters<typeof createNoteFixture>[0] = {}) {
  return createNoteFixture({ campaignId, ...overrides })
}

function planningContext(
  overrides?: Partial<SurfaceDropPlanningContext>,
): SurfaceDropPlanningContext {
  return {
    workspaceId: campaignId,
    ...overrides,
  }
}

describe('resolveSurfaceDropCommand', () => {
  it('plans surface drops from planning context without executable DnD operations', () => {
    const first = createNote()
    const second = createNote()
    const target = {
      type: MAP_DROP_ZONE_TYPE,
      mapId: testResourceId('map_99'),
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

  it('blocks a single invalid surface item with its rejection reason', () => {
    const targetNote = createNote()

    const command = resolveSurfaceDropCommand(
      [targetNote],
      { type: NOTE_EDITOR_DROP_TYPE, noteId: targetNote.id },
      planningContext(),
    )

    expect(command).toEqual({ status: 'blocked', reason: 'self_link' })
  })

  it('returns a partial command when only some surface items are valid', () => {
    const targetNote = createNote()
    const valid = createNote()

    expect(
      resolveSurfaceDropCommand(
        [targetNote, valid],
        { type: NOTE_EDITOR_DROP_TYPE, noteId: targetNote.id },
        planningContext(),
      ),
    ).toMatchObject({
      status: 'partial',
      commandId: 'surface-drop.link-sidebar-item-in-note',
      action: 'link',
      items: [valid],
      rejectedItems: [{ item: targetNote, reason: 'self_link' }],
      label: 'Add link here',
    })
  })

  it('keeps rejection details when multiple surface items are invalid', () => {
    const targetNote = createNote()
    const trashed = createNote({ status: 'trashed' })

    expect(
      resolveSurfaceDropCommand(
        [targetNote, trashed],
        { type: NOTE_EDITOR_DROP_TYPE, noteId: targetNote.id },
        planningContext(),
      ),
    ).toMatchObject({
      status: 'failed',
      commandId: 'surface-drop.link-sidebar-item-in-note',
      action: 'link',
      items: [],
      rejectedItems: [
        { item: targetNote, reason: 'self_link' },
        { item: trashed, reason: 'trashed_item' },
      ],
      label: 'No items can be linked here',
    })
  })

  it('routes note editor drops to embed creation when requested by modifier state', () => {
    const note = createNote()
    const targetNote = createNote()

    const command = resolveSurfaceDropCommand(
      [note],
      { type: NOTE_EDITOR_DROP_TYPE, noteId: targetNote.id },
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

  it('plans empty embed replacements as single-slot note embed commands', () => {
    const note = createNote()
    const targetNote = createNote()
    const target = {
      type: EMPTY_EMBED_DROP_TYPE,
      sourceItemId: targetNote.id,
      embedBlockId: 'embed-block-1',
    }

    const command = resolveSurfaceDropCommand([note], target, planningContext())

    expect(command).toMatchObject({
      status: 'ready',
      commandId: 'surface-drop.embed-sidebar-item-in-note',
      action: 'noteEmbed',
      items: [note],
      rejectedItems: [],
      target,
      label: 'Embed item here',
    })
  })

  it('enforces empty embed targets as one-slot replacements', () => {
    const first = createNote()
    const second = createNote()
    const targetNote = createNote()

    expect(
      resolveSurfaceDropCommand(
        [first, second],
        {
          type: EMPTY_EMBED_DROP_TYPE,
          sourceItemId: targetNote.id,
          embedBlockId: 'embed-block-1',
        },
        planningContext(),
      ),
    ).toEqual({ status: 'blocked', reason: 'unexpected_action' })
  })

  it('rejects wrong-workspace items using planning context workspace id', () => {
    const note = createNote({ campaignId: testCampaignId('other_campaign') })

    expect(
      resolveSurfaceDropCommand(
        [note],
        {
          type: MAP_DROP_ZONE_TYPE,
          mapId: testResourceId('map_99'),
          mapName: 'World Map',
          pinnedItemIds: [],
        },
        planningContext(),
      ),
    ).toEqual({ status: 'blocked', reason: 'wrong_workspace' })
  })

  it('rejects wrong-workspace note link drops using planning context workspace id', () => {
    const note = createNote({ campaignId: testCampaignId('other_campaign') })

    expect(
      resolveSurfaceDropCommand(
        [note],
        { type: NOTE_EDITOR_DROP_TYPE, noteId: testResourceId('note_99') },
        planningContext(),
      ),
    ).toEqual({ status: 'blocked', reason: 'wrong_workspace' })
  })
})
