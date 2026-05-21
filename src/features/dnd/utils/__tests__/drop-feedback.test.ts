import { describe, expect, it } from 'vitest'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { DropPlanningContext } from '~/features/dnd/utils/drop-planning-context'
import {
  CANVAS_DROP_ZONE_TYPE,
  MAP_DROP_ZONE_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
} from '~/features/dnd/utils/drop-target-data'
import type { ResolvedSidebarItemDropData } from '~/features/dnd/utils/drop-target-data'
import type { SidebarItemName } from 'shared/sidebar-items/name'
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

function createFolderDropData(
  overrides?: Parameters<typeof createFolder>[0],
): ResolvedSidebarItemDropData {
  return { ...createFolder(overrides), ancestorIds: [] }
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
        label: 'Move item to "Test Campaign"',
      },
    })
  })

  it('uses copy feedback for ctrl-dragging to filesystem targets', () => {
    const note = createNote({ parentId: testId<'sidebarItems'>('folder_1') })

    expect(
      resolveDropFeedback([note], { type: SIDEBAR_ROOT_DROP_TYPE }, planningContext(), {
        copy: true,
      }),
    ).toEqual({
      outcome: {
        type: 'operation',
        action: 'copy',
        label: 'Copy item to "Test Campaign"',
      },
    })
  })

  it('uses copy feedback for multi-item ctrl-dragging to folders', () => {
    const first = createNote({ parentId: testId<'sidebarItems'>('folder_1') })
    const second = createNote({ parentId: testId<'sidebarItems'>('folder_1') })
    const folder = createFolder({ name: 'Destination' })

    expect(
      resolveDropFeedback([first, second], { ...folder, ancestorIds: [] }, planningContext(), {
        copy: true,
      }),
    ).toEqual({
      outcome: {
        type: 'operation',
        action: 'copy',
        label: 'Copy 2 items to "Destination"',
      },
    })
  })

  it('falls back to an unnamed folder label for copy feedback', () => {
    const note = createNote()
    const folder: ResolvedSidebarItemDropData = {
      ...createFolderDropData(),
      name: '' as SidebarItemName,
    }

    expect(resolveDropFeedback([note], folder, planningContext(), { copy: true })).toMatchObject({
      outcome: {
        action: 'copy',
        label: 'Copy item to "Unnamed folder"',
      },
    })
  })

  it('keeps ctrl-drag surface targets on their surface feedback path', () => {
    const note = createNote()

    expect(
      resolveDropFeedback(
        [note],
        {
          type: MAP_DROP_ZONE_TYPE,
          mapId: testId<'sidebarItems'>('map_1'),
          mapName: 'World Map',
          pinnedItemIds: [],
        },
        planningContext(),
        { copy: true },
      ),
    ).toEqual({
      outcome: {
        type: 'operation',
        action: 'pin',
        label: 'Pin item to "World Map"',
      },
    })
  })

  it('returns copy rejection feedback when a copy source lacks permission', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.VIEW })
    const folder = createFolder({ name: 'Destination' })

    expect(
      resolveDropFeedback([note], { ...folder, ancestorIds: [] }, planningContext(), {
        copy: true,
      }),
    ).toEqual({
      outcome: { type: 'rejection', reason: 'no_permission' },
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
        label: 'Pin item to "World Map"',
      },
      rejectedItemCount: 1,
    })
  })

  it('uses rejection feedback when a single item cannot be dropped on a surface target', () => {
    const note = createNote()

    expect(
      resolveDropFeedback(
        [note],
        {
          type: CANVAS_DROP_ZONE_TYPE,
          canvasId: note._id,
        },
        planningContext(),
      ),
    ).toEqual({
      outcome: {
        type: 'rejection',
        reason: 'self_embed',
      },
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
