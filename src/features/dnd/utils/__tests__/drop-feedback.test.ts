import { describe, expect, it } from 'vitest'
import type { DropPlanningContext } from '~/features/dnd/utils/drop-planning-context'
import {
  CANVAS_DROP_ZONE_TYPE,
  MAP_DROP_ZONE_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
} from '~/features/dnd/utils/drop-target-data'
import { resolveDropFeedback } from '~/features/dnd/utils/drop-feedback'
import { createFolder, createGameMap, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

function planningContext(overrides?: Partial<DropPlanningContext>): DropPlanningContext {
  return {
    campaignId: testId<'campaigns'>('campaign_1'),
    campaignName: 'Test Campaign',
    isDm: true,
    ...overrides,
  }
}

describe('resolveDropFeedback', () => {
  it('returns empty feedback without dragged items or target', () => {
    expect(resolveDropFeedback(null, { type: SIDEBAR_ROOT_DROP_TYPE }, planningContext())).toEqual({
      outcome: null,
    })
    expect(resolveDropFeedback([], null, planningContext())).toEqual({ outcome: null })
  })

  it('uses global move feedback for filesystem targets', () => {
    const note = createNote({ parentId: testId<'sidebarItems'>('folder_1') })

    expect(
      resolveDropFeedback([note], { type: SIDEBAR_ROOT_DROP_TYPE }, planningContext()),
    ).toEqual({
      outcome: {
        type: 'operation',
        action: 'move',
        label: 'Move to "Test Campaign"',
        execute: null,
      },
    })
  })

  it('uses surface batch labels for surface targets', () => {
    const first = createNote()
    const second = createNote()

    expect(
      resolveDropFeedback(
        [first, second],
        {
          type: CANVAS_DROP_ZONE_TYPE,
          canvasId: testId<'sidebarItems'>('canvas_1'),
        },
        planningContext(),
      ),
    ).toEqual({
      outcome: {
        type: 'operation',
        action: 'embed',
        label: 'Embed 2 items in canvas',
        execute: null,
      },
    })
  })

  it('reports partial surface rejection counts without losing accepted operation feedback', () => {
    const map = createGameMap()
    const note = createNote()

    expect(
      resolveDropFeedback(
        [note, map],
        {
          type: MAP_DROP_ZONE_TYPE,
          mapId: map._id,
          mapName: 'World Map',
          pinnedItemIds: [],
        },
        planningContext(),
      ),
    ).toEqual({
      outcome: {
        type: 'operation',
        action: 'pin',
        label: 'Pin to "World Map"',
        execute: null,
      },
      rejectedItemCount: 1,
    })
  })

  it('returns blocked feedback for hard global rejections', () => {
    const folder = createFolder()
    const note = createNote()

    expect(
      resolveDropFeedback(
        [folder, note],
        {
          ...createFolder(),
          ancestorIds: [folder._id],
        },
        planningContext(),
      ),
    ).toEqual({
      outcome: { type: 'rejection', reason: 'circular' },
    })
  })
})
