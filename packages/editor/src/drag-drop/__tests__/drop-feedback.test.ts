import { describe, expect, it } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { DropPlanningContext } from '../planning-context'
import {
  CANVAS_DROP_ZONE_TYPE,
  EMPTY_EMBED_DROP_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
} from '../drop-target-data'
import type { ResolvedSidebarItemDropData } from '../drop-target-data'
import type { AnyItem } from '../../workspace/items'
import type { ResourceTitle } from '../../resources/resource-contract'
import { resolveDropCommand, resolveDropCommandFeedback } from '../drop-command-planner'
import {
  createFolder as createFolderFixture,
  createGameMap as createGameMapFixture,
  createNote as createNoteFixture,
} from '../../test/sidebar-item-factory'
import { testId } from '../../test/id'
import { testCampaignId } from '../../../../../shared/test/campaign-id'

const campaignId = testCampaignId('campaign_1')

function createNote(overrides: Parameters<typeof createNoteFixture>[0] = {}) {
  return createNoteFixture({ campaignId, ...overrides })
}

function createFolder(overrides: Parameters<typeof createFolderFixture>[0] = {}) {
  return createFolderFixture({ campaignId, ...overrides })
}

function createGameMap(overrides: Parameters<typeof createGameMapFixture>[0] = {}) {
  return createGameMapFixture({ campaignId, ...overrides })
}

function planningContext(overrides?: Partial<DropPlanningContext>): DropPlanningContext {
  return {
    workspaceId: campaignId,
    workspaceName: 'Test Campaign',
    canCreateRootItems: true,
    canManageFolders: true,
    ...overrides,
  }
}

function createFolderDropData(
  overrides?: Parameters<typeof createFolder>[0],
): ResolvedSidebarItemDropData {
  return { ...createFolder(overrides), ancestorIds: [] }
}

function resolveDropFeedback(
  draggedItems: Array<AnyItem> | null | undefined,
  target: Parameters<typeof resolveDropCommand>[0]['target'],
  ctx: DropPlanningContext,
  options: Parameters<typeof resolveDropCommand>[0]['options'] = {},
) {
  if (!target || !draggedItems || draggedItems.length === 0) return { outcome: null }
  const command = resolveDropCommand({
    payload: { kind: 'resources', items: draggedItems },
    target,
    ctx,
    options,
  })
  const rejectedItemCount =
    command.kind === 'surface' && command.command.status === 'partial'
      ? command.command.rejectedItems.length
      : undefined
  return {
    outcome: resolveDropCommandFeedback(command),
    ...(rejectedItemCount === undefined ? {} : { rejectedItemCount }),
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
      name: '' as ResourceTitle,
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
      outcome: { type: 'rejection', reason: 'no_source_permission' },
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

  it('uses embed feedback for shift-dragging sidebar items into note editors', () => {
    const note = createNote()

    expect(
      resolveDropFeedback(
        [note],
        {
          type: NOTE_EDITOR_DROP_TYPE,
          noteId: testId<'sidebarItems'>('note_target'),
        },
        planningContext(),
        { noteEditorDropAction: 'embed' },
      ),
    ).toEqual({
      outcome: {
        type: 'operation',
        action: 'embed',
        label: 'Embed item here',
      },
    })
  })

  it('uses embed feedback when hovering an empty embed drop target', () => {
    const note = createNote()
    const target = createNote()

    expect(
      resolveDropFeedback(
        [note],
        { type: EMPTY_EMBED_DROP_TYPE, sourceItemId: target.id, embedBlockId: 'embed-block-1' },
        planningContext(),
      ),
    ).toEqual({
      outcome: {
        type: 'operation',
        action: 'embed',
        label: 'Embed item here',
      },
    })
  })

  it('rejects multi-item empty embed replacement feedback', () => {
    const first = createNote()
    const second = createNote()
    const target = createNote()

    expect(
      resolveDropFeedback(
        [first, second],
        { type: EMPTY_EMBED_DROP_TYPE, sourceItemId: target.id, embedBlockId: 'embed-block-1' },
        planningContext(),
      ),
    ).toEqual({
      outcome: { type: 'rejection', reason: 'unexpected_action' },
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
          mapId: map.id,
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
          canvasId: note.id,
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
          ancestorIds: [folder.id],
        },
        planningContext(),
      ),
    ).toEqual({
      outcome: { type: 'rejection', reason: 'circular' },
    })
  })
})
