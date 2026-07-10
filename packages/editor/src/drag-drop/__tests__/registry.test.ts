import { describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { AnyItem } from '../../workspace/items'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { DropPlanningContext } from '../planning-context'
import type {
  CanvasDropZoneData,
  EmptyEmbedDropZoneData,
  MapDropZoneData,
  NoteEditorDropZoneData,
  ResolvedSidebarItemDropData,
  SidebarDropData,
} from '../drop-target-data'
import {
  createFile as createFileFixture,
  createFolder as createFolderFixture,
  createGameMap as createGameMapFixture,
  createNote as createNoteFixture,
} from '../../test/sidebar-item-factory'
import { getDragItemId, getDragItemIds, getDragPreviewItemIds } from '../source-data'
import { rejectionReasonMessage } from '../rejections'
import {
  resolveFileSystemDropTarget,
  resolveGlobalFileSystemDropCommand as resolveFileSystemCommand,
} from '../../filesystem/drop-planner'
import { resolveSurfaceDropCommand } from '../surface-planner'
import { resolveDropCommand, resolveDropCommandFeedback } from '../drop-command-planner'
import {
  CANVAS_DROP_ZONE_TYPE,
  EMPTY_EDITOR_DROP_TYPE,
  EMPTY_EMBED_DROP_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
  TRASH_DROP_ZONE_TYPE,
  getDropTargetKey,
  resolveDropTarget,
} from '../drop-target-data'
import { testId } from '../../test/id'
import { createResourceCatalogModel } from '../../filesystem/catalog'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const campaignId = testId<'campaigns'>('campaign_1')

function createNote(overrides: Parameters<typeof createNoteFixture>[0] = {}) {
  return createNoteFixture({ campaignId, ...overrides })
}

function createFolder(overrides: Parameters<typeof createFolderFixture>[0] = {}) {
  return createFolderFixture({ campaignId, ...overrides })
}

function createGameMap(overrides: Parameters<typeof createGameMapFixture>[0] = {}) {
  return createGameMapFixture({ campaignId, ...overrides })
}

function createFile(overrides: Parameters<typeof createFileFixture>[0] = {}) {
  return createFileFixture({ campaignId, ...overrides })
}

type SidebarRootDropZoneData = Extract<SidebarDropData, { type: typeof SIDEBAR_ROOT_DROP_TYPE }>
type EmptyEditorDropZoneData = Extract<SidebarDropData, { type: typeof EMPTY_EDITOR_DROP_TYPE }>
type TrashDropZoneData = Extract<SidebarDropData, { type: typeof TRASH_DROP_ZONE_TYPE }>

function createCtx(overrides?: Partial<DropPlanningContext>): DropPlanningContext {
  return {
    workspaceId: campaignId,
    workspaceName: 'Test Campaign',
    canCreateRootItems: true,
    canManageFolders: true,
    ...overrides,
  }
}

function resolveTestDropCommand(
  items: Parameters<typeof resolveFileSystemCommand>[0],
  target: SidebarDropData,
  ctx: DropPlanningContext,
) {
  const globalCommand = resolveTestGlobalDropCommand(items, target, ctx)
  return globalCommand.status === 'noop'
    ? resolveSurfaceDropCommand(items, target, ctx)
    : globalCommand
}

function resolveTestGlobalDropCommand(
  items: Parameters<typeof resolveFileSystemCommand>[0],
  target: SidebarDropData,
  ctx: DropPlanningContext,
  options?: Parameters<typeof resolveFileSystemCommand>[3],
) {
  const fileSystemTarget = resolveFileSystemDropTarget(target, ctx)
  return fileSystemTarget
    ? resolveFileSystemCommand(items, fileSystemTarget, ctx, options)
    : { status: 'noop' }
}

function resolveDropOutcome(
  item: AnyItem | null,
  target: SidebarDropData | null,
  ctx: DropPlanningContext,
  options?: Parameters<typeof resolveDropCommand>[0]['options'],
) {
  if (!item || !target) return null
  return resolveDropCommandFeedback(
    resolveDropCommand({
      payload: { kind: 'resources', items: [item] },
      target,
      ctx,
      options,
    }),
  )
}

function trashTarget(): TrashDropZoneData {
  return { type: TRASH_DROP_ZONE_TYPE }
}

function rootTarget(): SidebarRootDropZoneData {
  return { type: SIDEBAR_ROOT_DROP_TYPE }
}

function emptyEditorTarget(): EmptyEditorDropZoneData {
  return { type: EMPTY_EDITOR_DROP_TYPE }
}

function emptyEmbedTarget(
  sourceItemId = testId<'sidebarItems'>('note_99'),
  embedBlockId = 'embed-block-99',
): EmptyEmbedDropZoneData {
  return { type: EMPTY_EMBED_DROP_TYPE, sourceItemId, embedBlockId }
}

function noteEditorTarget(noteId = testId<'sidebarItems'>('note_99')): NoteEditorDropZoneData {
  return { type: NOTE_EDITOR_DROP_TYPE, noteId }
}

function mapTarget(
  mapId = testId<'sidebarItems'>('map_99'),
  overrides?: Partial<MapDropZoneData>,
): MapDropZoneData {
  return {
    type: MAP_DROP_ZONE_TYPE,
    mapId,
    mapName: 'World Map',
    pinnedItemIds: [],
    ...overrides,
  }
}

function canvasTarget(canvasId = testId<'sidebarItems'>('canvas_99')): CanvasDropZoneData {
  return { type: CANVAS_DROP_ZONE_TYPE, canvasId }
}

function testCatalog({
  activeItems = [],
  trashItems = [],
}: {
  activeItems?: Array<AnyItem>
  trashItems?: Array<AnyItem>
} = {}) {
  return createResourceCatalogModel({
    activeItems,
    trashItems,
  }).catalog
}

function folderTarget(
  overrides?: Partial<ResolvedSidebarItemDropData>,
): ResolvedSidebarItemDropData {
  const folder = createFolder()
  return {
    ...folder,
    ancestorIds: [],
    ...overrides,
  } as ResolvedSidebarItemDropData
}

// ─── getDragItemId ─────────────────────────────────────────────────

describe('getDragItemId', () => {
  it('extracts sidebarItemId from source data', () => {
    expect(getDragItemId({ sidebarItemId: 'note_1' })).toBe('note_1')
  })

  it('returns null when sidebarItemId is missing', () => {
    expect(getDragItemId({})).toBeNull()
  })

  it('returns null when sidebarItemId is not a string', () => {
    expect(getDragItemId({ sidebarItemId: 42 })).toBeNull()
  })
})

describe('getDragItemIds', () => {
  it('extracts batch sidebar ids from source data', () => {
    expect(getDragItemIds({ sidebarItemIds: ['note_1', 'map_1'] })).toEqual(['note_1', 'map_1'])
  })

  it('does not fall back to single-id source data', () => {
    expect(getDragItemIds({ sidebarItemId: 'note_1' })).toEqual([])
  })

  it('ignores non-string batch ids', () => {
    expect(getDragItemIds({ sidebarItemIds: ['note_1', 42, null] })).toEqual(['note_1'])
  })
})

describe('getDragPreviewItemIds', () => {
  it('uses explicit preview ids when operation ids are normalized', () => {
    expect(
      getDragPreviewItemIds({
        sidebarItemIds: ['folder_1'],
        dragPreviewItemIds: ['folder_1', 'note_1', 'note_2'],
      }),
    ).toEqual(['folder_1', 'note_1', 'note_2'])
  })

  it('falls back to operation ids when explicit preview ids are missing', () => {
    expect(getDragPreviewItemIds({ sidebarItemIds: ['folder_1'] })).toEqual(['folder_1'])
  })
})

// ─── rejectionReasonMessage ────────────────────────────────────────

describe('rejectionReasonMessage', () => {
  it('returns message for each rejection reason', () => {
    expect(rejectionReasonMessage('no_source_permission')).toBe('No permission to move here')
    expect(rejectionReasonMessage('no_target_permission')).toBe('No permission to move here')
    expect(rejectionReasonMessage('circular')).toBe('Cannot move folder into itself')
    expect(rejectionReasonMessage('missing_ancestor_ids')).toBe('Cannot move folder into itself')
    expect(rejectionReasonMessage('self_pin')).toBe('Cannot pin map to itself')
    expect(rejectionReasonMessage('self_link')).toBe('Cannot link note to itself')
    expect(rejectionReasonMessage('self_embed')).toBe('Cannot embed item into itself')
    expect(rejectionReasonMessage('already_pinned')).toBe('Already pinned to this map')
    expect(rejectionReasonMessage('wrong_workspace')).toBe('Item belongs to another workspace')
    expect(rejectionReasonMessage('not_trashed')).toBe('Item must be trashed for this operation')
    expect(rejectionReasonMessage('not_folder')).toBe('Cannot drop here')
    expect(rejectionReasonMessage('not_found')).toBe('Missing data')
    expect(rejectionReasonMessage('invalid_target')).toBe('Missing data')
    expect(rejectionReasonMessage('missing_data')).toBe('Missing data')
    expect(rejectionReasonMessage('trashed_folder')).toBe('Trashed folders are uneditable')
    expect(rejectionReasonMessage('name_conflict')).toBe(
      'An item with this name already exists here',
    )
    expect(rejectionReasonMessage('dm_only')).toBe('Only the DM can do this')
    expect(rejectionReasonMessage('already_trashed')).toBe(
      'Restore the item before dropping it here',
    )
    expect(rejectionReasonMessage('trashed_item')).toBe('Restore the item before dropping it here')
    expect(rejectionReasonMessage('mixed_actions')).toBe(
      'Cannot move trashed and non-trashed items together',
    )
    expect(rejectionReasonMessage('unexpected_action')).toBe('Cannot perform that action here')
  })
})

// ─── resolveDropOutcome ────────────────────────────────────────────

describe('resolveDropOutcome', () => {
  it('returns null when item is null', () => {
    expect(resolveDropOutcome(null, trashTarget(), createCtx())).toBeNull()
  })

  it('returns null when target is null', () => {
    expect(resolveDropOutcome(createNote(), null, createCtx())).toBeNull()
  })

  // ── Source permission check ──

  it('rejects move when item lacks FULL_ACCESS', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.EDIT })
    const target = folderTarget()
    const result = resolveDropOutcome(note, target, createCtx())

    expect(result).toEqual({ type: 'rejection', reason: 'no_source_permission' })
  })

  it('rejects trash when item lacks FULL_ACCESS', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.VIEW })
    const result = resolveDropOutcome(note, trashTarget(), createCtx())

    expect(result).toEqual({ type: 'rejection', reason: 'no_source_permission' })
  })

  it('allows pin even without FULL_ACCESS', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.VIEW })
    const result = resolveDropOutcome(note, mapTarget(), createCtx())

    expect(result?.type).toBe('operation')
    expect((result as { action: string }).action).toBe('pin')
  })

  // ── Trash zone ──

  describe('trash zone', () => {
    it('allows trashing a sidebar note', () => {
      const note = createNote()
      const result = resolveDropOutcome(note, trashTarget(), createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'trash' })
    })

    it('returns null for already-trashed item', () => {
      const note = createNote({ status: 'trashed' })
      const result = resolveDropOutcome(note, trashTarget(), createCtx())

      expect(result).toBeNull()
    })

    it('rejects trashing a folder as non-DM', () => {
      const folder = createFolder()
      const ctx = createCtx({ canManageFolders: false })
      const result = resolveDropOutcome(folder, trashTarget(), ctx)

      expect(result).toEqual({ type: 'rejection', reason: 'dm_only' })
    })

    it('allows DM to trash a folder', () => {
      const folder = createFolder()
      const result = resolveDropOutcome(folder, trashTarget(), createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'trash' })
    })
  })

  // ── Root zone ──

  describe('root zone', () => {
    it('allows moving nested item to root', () => {
      const note = createNote({ parentId: testId<'sidebarItems'>('folder_1') })
      const result = resolveDropOutcome(note, rootTarget(), createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'move' })
      expect((result as { label: string }).label).toContain('Test Campaign')
    })

    it('returns null when item is already at root', () => {
      const note = createNote({ parentId: null })
      const result = resolveDropOutcome(note, rootTarget(), createCtx())

      expect(result).toBeNull()
    })

    it('allows restoring trashed item to root', () => {
      const note = createNote({ status: 'trashed' })
      const result = resolveDropOutcome(note, rootTarget(), createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'restore' })
    })

    it('rejects restoring a folder as non-DM', () => {
      const folder = createFolder({ status: 'trashed' })
      const ctx = createCtx({ canManageFolders: false })
      const result = resolveDropOutcome(folder, rootTarget(), ctx)

      expect(result).toEqual({ type: 'rejection', reason: 'dm_only' })
    })
  })

  // ── Folder zone ──

  describe('folder zone', () => {
    it('allows moving item into folder', () => {
      const note = createNote()
      const target = folderTarget()
      const result = resolveDropOutcome(note, target, createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'move' })
      expect((result as { label: string }).label).toContain(target.name)
    })

    it('returns null when dropping item on itself', () => {
      const folder = createFolder()
      const target = folderTarget({
        id: folder.id,
      } satisfies Partial<ResolvedSidebarItemDropData>)
      const result = resolveDropOutcome(folder, target, createCtx())

      expect(result).toBeNull()
    })

    it('returns null when item is already in target folder', () => {
      const target = folderTarget()
      const note = createNote({ parentId: testId<'sidebarItems'>(target.id) })
      const result = resolveDropOutcome(note, target, createCtx())

      expect(result).toBeNull()
    })

    it('rejects drop on trashed folder', () => {
      const note = createNote()
      const target = folderTarget({
        status: 'trashed',
      } satisfies Partial<ResolvedSidebarItemDropData>)
      const result = resolveDropOutcome(note, target, createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'trashed_folder' })
    })

    it('rejects circular move (folder into its descendant)', () => {
      const folder = createFolder()
      const target = folderTarget({
        ancestorIds: [folder.id],
      })
      const result = resolveDropOutcome(folder, target, createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'circular' })
    })

    it('does not reject circular for non-folder items', () => {
      const note = createNote()
      const target = folderTarget({
        ancestorIds: [testId<'sidebarItems'>(note.id)],
      })
      const result = resolveDropOutcome(note, target, createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'move' })
    })

    it('rejects when target folder lacks FULL_ACCESS permission', () => {
      const note = createNote()
      const target = folderTarget({
        myPermissionLevel: PERMISSION_LEVEL.EDIT,
      } satisfies Partial<ResolvedSidebarItemDropData>)
      const result = resolveDropOutcome(note, target, createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'no_target_permission' })
    })

    it('allows restoring trashed item into folder', () => {
      const note = createNote({ status: 'trashed' })
      const target = folderTarget()
      const result = resolveDropOutcome(note, target, createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'restore' })
    })

    it('rejects restoring a folder as non-DM', () => {
      const folder = createFolder({ status: 'trashed' })
      const target = folderTarget()
      const ctx = createCtx({ canManageFolders: false })
      const result = resolveDropOutcome(folder, target, ctx)

      expect(result).toEqual({ type: 'rejection', reason: 'dm_only' })
    })
  })

  // ── Map zone ──

  describe('map zone', () => {
    it('allows pinning a note to a map', () => {
      const note = createNote()
      const result = resolveDropOutcome(note, mapTarget(), createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'pin' })
      expect((result as { label: string }).label).toContain('World Map')
    })

    it('rejects pinning a map to itself', () => {
      const map = createGameMap()
      const target = mapTarget(map.id)
      const result = resolveDropOutcome(map, target, createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'self_pin' })
    })

    it('rejects pinning an already-pinned item', () => {
      const note = createNote()
      const target = mapTarget(testId<'sidebarItems'>('map_99'), {
        pinnedItemIds: [note.id],
      })
      const result = resolveDropOutcome(note, target, createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'already_pinned' })
    })
  })

  // ── Empty editor zone ──

  describe('empty editor zone', () => {
    it('returns open action', () => {
      const note = createNote()
      const result = resolveDropOutcome(note, emptyEditorTarget(), createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'open' })
    })
  })

  // ── Note editor zone ──

  describe('note editor zone', () => {
    it('returns link action for sidebar item', () => {
      const note = createNote()
      const result = resolveDropOutcome(note, noteEditorTarget(), createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'link' })
    })

    it('returns embed action for shift-dragged sidebar items', () => {
      const note = createNote()
      const result = resolveDropOutcome(note, noteEditorTarget(), createCtx(), {
        noteEditorDropAction: 'embed',
      })

      expect(result).toMatchObject({ type: 'operation', action: 'embed' })
    })

    it('rejects linking a trashed item', () => {
      const note = createNote({ status: 'trashed' })
      const result = resolveDropOutcome(note, noteEditorTarget(), createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'trashed_item' })
    })
  })

  // ── Canvas zone ──

  describe('canvas zone', () => {
    it('returns embed action for a sidebar item', () => {
      const note = createNote()
      const result = resolveDropOutcome(note, canvasTarget(), createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'embed' })
    })

    it('rejects embedding a canvas into itself', () => {
      const canvas = createNote()
      const target = canvasTarget(testId<'sidebarItems'>(canvas.id))
      const result = resolveDropOutcome(canvas, target, createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'self_embed' })
    })

    it('rejects embedding a trashed item', () => {
      const note = createNote({ status: 'trashed' })
      const result = resolveDropOutcome(note, canvasTarget(), createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'trashed_item' })
    })

    it('allows embed even without FULL_ACCESS', () => {
      const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.VIEW })
      const result = resolveDropOutcome(note, canvasTarget(), createCtx())

      expect(result?.type).toBe('operation')
      expect((result as { action: string }).action).toBe('embed')
    })

    it('reports canvas embeds as monitor-handled operations', () => {
      const note = createNote()
      const result = resolveDropOutcome(note, canvasTarget(), createCtx())

      expect(result).toMatchObject({
        type: 'operation',
        action: 'embed',
        label: 'Embed item in canvas',
      })
    })
  })

  // ── Non-folder sidebar items ──

  describe('non-folder sidebar item targets', () => {
    it('returns null when dropping on a note', () => {
      const draggedNote = createNote()
      const targetNote = createNote()
      const target: ResolvedSidebarItemDropData = {
        ...targetNote,
        ancestorIds: [],
      } as ResolvedSidebarItemDropData
      const result = resolveDropOutcome(draggedNote, target, createCtx())

      expect(result).toBeNull()
    })

    it('returns null when dropping on a file', () => {
      const note = createNote()
      const file = createFile()
      const target: ResolvedSidebarItemDropData = {
        ...file,
        ancestorIds: [],
      } as ResolvedSidebarItemDropData
      const result = resolveDropOutcome(note, target, createCtx())

      expect(result).toBeNull()
    })
  })
})

describe('global filesystem drop planning', () => {
  it('returns noop when every selected item is already in the target folder', () => {
    const target = folderTarget()
    const first = createNote({ parentId: target.id })
    const second = createNote({ parentId: target.id })
    const result = resolveTestGlobalDropCommand([first, second], target, createCtx())

    expect(result).toEqual({ status: 'noop' })
  })

  it('returns noop when every selected active item is already at root', () => {
    const first = createNote({ parentId: null })
    const second = createNote({ parentId: null })
    const result = resolveTestGlobalDropCommand([first, second], rootTarget(), createCtx())

    expect(result).toEqual({ status: 'noop' })
  })

  it('returns movable items while ignoring selected items already in the target folder', () => {
    const target = folderTarget()
    const alreadyInside = createNote({ parentId: target.id })
    const outside = createNote({ parentId: testId<'sidebarItems'>('folder_other') })
    const result = resolveTestGlobalDropCommand([alreadyInside, outside], target, createCtx())

    expect(result).toMatchObject({
      status: 'ready',
      plan: {
        command: { type: 'move', itemIds: [outside.id], targetParentId: target.id },
      },
    })
  })

  it('blocks the whole batch when any selected item has a real rejection', () => {
    const folder = createFolder()
    const target = folderTarget({ ancestorIds: [folder.id] })
    const note = createNote()
    const result = resolveTestGlobalDropCommand([folder, note], target, createCtx())

    expect(result).toEqual({ status: 'blocked', reason: 'circular' })
  })

  it('blocks mixed move and restore batches with a specific reason', () => {
    const target = folderTarget()
    const active = createNote()
    const trashed = createNote({ status: 'trashed' })
    const result = resolveTestGlobalDropCommand([active, trashed], target, createCtx())

    expect(result).toEqual({ status: 'blocked', reason: 'mixed_actions' })
  })
})

describe('resolveTestDropCommand', () => {
  it('returns a no-op command when every selected item is already in the target folder', () => {
    const target = folderTarget()
    const first = createNote({ parentId: target.id })
    const second = createNote({ parentId: target.id })

    expect(resolveTestDropCommand([first, second], target, createCtx())).toEqual({ status: 'noop' })
  })

  it('returns one batch move command while ignoring selected items already in the target folder', () => {
    const target = folderTarget()
    const alreadyInside = createNote({ parentId: target.id })
    const outside = createNote({ parentId: testId<'sidebarItems'>('folder_other') })

    expect(resolveTestDropCommand([alreadyInside, outside], target, createCtx())).toMatchObject({
      status: 'ready',
      plan: {
        command: { type: 'move', itemIds: [outside.id], targetParentId: target.id },
      },
    })
  })

  it('returns one batch trash command for active selected items', () => {
    const first = createNote()
    const second = createNote()

    expect(resolveTestDropCommand([first, second], trashTarget(), createCtx())).toMatchObject({
      status: 'ready',
      plan: {
        command: { type: 'trash', itemIds: [first.id, second.id] },
      },
    })
  })

  it('returns one batch pin command for map drops', () => {
    const first = createNote()
    const second = createNote()
    const target = mapTarget()

    expect(resolveTestDropCommand([first, second], target, createCtx())).toMatchObject({
      status: 'ready',
      action: 'pin',
      items: [first, second],
      rejectedItems: [],
      target,
      label: 'Pin 2 items to "World Map"',
    })
  })

  it('returns a partial pin command when some items cannot be pinned', () => {
    const map = createGameMap()
    const note = createNote()
    const alreadyPinned = createNote()
    const target = mapTarget(map.id, { pinnedItemIds: [alreadyPinned.id] })

    expect(resolveTestDropCommand([note, map, alreadyPinned], target, createCtx())).toMatchObject({
      status: 'partial',
      action: 'pin',
      items: [note],
      rejectedItems: [
        { item: map, reason: 'self_pin' },
        { item: alreadyPinned, reason: 'already_pinned' },
      ],
      target,
      label: 'Pin item to "World Map"',
    })
  })

  it('returns one batch link command for note editor drops', () => {
    const targetNote = createNote()
    const first = createNote()
    const second = createNote()
    const target = noteEditorTarget(targetNote.id)

    expect(resolveTestDropCommand([first, second], target, createCtx())).toMatchObject({
      status: 'ready',
      action: 'link',
      items: [first, second],
      rejectedItems: [],
      target,
      label: 'Add 2 links here',
    })
  })

  it('returns a partial link command when the target note is part of the drag', () => {
    const targetNote = createNote()
    const other = createNote()
    const target = noteEditorTarget(targetNote.id)

    expect(resolveTestDropCommand([targetNote, other], target, createCtx())).toMatchObject({
      status: 'partial',
      action: 'link',
      items: [other],
      rejectedItems: [{ item: targetNote, reason: 'self_link' }],
      target,
      label: 'Add link here',
    })
  })

  it('blocks a single invalid surface item with its rejection reason', () => {
    const targetNote = createNote()
    const target = noteEditorTarget(targetNote.id)

    expect(resolveTestDropCommand([targetNote], target, createCtx())).toEqual({
      status: 'blocked',
      reason: 'self_link',
    })
  })

  it('keeps pin, link, and embed commands out of the global command path', () => {
    const note = createNote()

    expect(resolveTestGlobalDropCommand([note], mapTarget(), createCtx())).toEqual({
      status: 'noop',
    })
    expect(resolveTestGlobalDropCommand([note], noteEditorTarget(), createCtx())).toEqual({
      status: 'noop',
    })
    expect(resolveTestGlobalDropCommand([note], canvasTarget(), createCtx())).toEqual({
      status: 'noop',
    })
  })

  it('resolves pin, link, and embed through the surface command path', () => {
    const note = createNote()

    expect(resolveSurfaceDropCommand([note], mapTarget(), createCtx())).toMatchObject({
      status: 'ready',
      action: 'pin',
      items: [note],
    })
    expect(resolveSurfaceDropCommand([note], noteEditorTarget(), createCtx())).toMatchObject({
      status: 'ready',
      action: 'link',
      items: [note],
    })
    expect(resolveSurfaceDropCommand([note], canvasTarget(), createCtx())).toMatchObject({
      status: 'ready',
      action: 'embed',
      items: [note],
    })
  })

  it('returns one batch embed command for canvas drops', () => {
    const canvas = createGameMap({ id: testId<'sidebarItems'>('canvas_1') })
    const first = createNote()
    const second = createNote()
    const target = canvasTarget(canvas.id)

    expect(resolveTestDropCommand([first, second], target, createCtx())).toMatchObject({
      status: 'ready',
      action: 'embed',
      items: [first, second],
      rejectedItems: [],
      target,
      label: 'Embed 2 items in canvas',
    })
  })

  it('blocks the command when any selected item has a real rejection', () => {
    const folder = createFolder()
    const target = folderTarget({ ancestorIds: [folder.id] })
    const note = createNote()

    expect(resolveTestDropCommand([folder, note], target, createCtx())).toMatchObject({
      status: 'blocked',
      reason: 'circular',
    })
  })

  it('blocks mixed move and restore commands with a specific reason', () => {
    const target = folderTarget()
    const active = createNote()
    const trashed = createNote({ status: 'trashed' })

    expect(resolveTestDropCommand([active, trashed], target, createCtx())).toEqual({
      status: 'blocked',
      reason: 'mixed_actions',
    })
  })

  it('returns a copy command for ctrl-dragging active items into a folder', () => {
    const note = createNote({ parentId: null })
    const target = folderTarget()

    expect(resolveTestGlobalDropCommand([note], target, createCtx(), { copy: true })).toMatchObject(
      {
        status: 'ready',
        plan: {
          command: { type: 'copy', itemIds: [note.id], targetParentId: target.id },
        },
      },
    )
  })

  it('returns a copy command for ctrl-dragging active items to root', () => {
    const note = createNote({ parentId: testId<'sidebarItems'>('folder_1') })

    expect(
      resolveTestGlobalDropCommand([note], rootTarget(), createCtx(), { copy: true }),
    ).toMatchObject({
      status: 'ready',
      plan: {
        command: { type: 'copy', itemIds: [note.id], targetParentId: null },
      },
    })
  })

  it('blocks ctrl-drag copy to root for non-DM users', () => {
    const note = createNote({ parentId: testId<'sidebarItems'>('folder_1') })

    expect(
      resolveTestGlobalDropCommand([note], rootTarget(), createCtx({ canCreateRootItems: false }), {
        copy: true,
      }),
    ).toEqual({
      status: 'blocked',
      reason: 'dm_only',
    })
  })

  it('blocks ctrl-drag copy when the source item is trashed', () => {
    const note = createNote({ status: 'trashed' })
    const target = folderTarget()

    expect(resolveTestGlobalDropCommand([note], target, createCtx(), { copy: true })).toEqual({
      status: 'blocked',
      reason: 'trashed_item',
    })
  })

  it('blocks ctrl-drag copy when the target folder lacks permission', () => {
    const note = createNote()
    const target = folderTarget({ myPermissionLevel: PERMISSION_LEVEL.VIEW })

    expect(resolveTestGlobalDropCommand([note], target, createCtx(), { copy: true })).toEqual({
      status: 'blocked',
      reason: 'no_target_permission',
    })
  })

  it('blocks ctrl-drag copy of a folder into its descendant', () => {
    const folder = createFolder()
    const target = folderTarget({ ancestorIds: [folder.id] })

    expect(resolveTestGlobalDropCommand([folder], target, createCtx(), { copy: true })).toEqual({
      status: 'blocked',
      reason: 'circular',
    })
  })

  it('copies into the same parent instead of treating ctrl-drag as a no-op', () => {
    const target = folderTarget()
    const note = createNote({ parentId: target.id })

    expect(resolveTestGlobalDropCommand([note], target, createCtx(), { copy: true })).toMatchObject(
      {
        status: 'ready',
        plan: {
          command: { type: 'copy', itemIds: [note.id], targetParentId: target.id },
        },
      },
    )
  })

  it('does not copy to trash on ctrl-drag', () => {
    const note = createNote()

    expect(
      resolveTestGlobalDropCommand([note], trashTarget(), createCtx(), { copy: true }),
    ).toMatchObject({
      status: 'ready',
      plan: {
        command: { type: 'trash', itemIds: [note.id] },
      },
    })
  })
})

// ─── getDropTargetKey ──────────────────────────────────────────────

describe('getDropTargetKey', () => {
  it('returns null for null target', () => {
    expect(getDropTargetKey(null)).toBeNull()
  })

  it('returns null for unknown type', () => {
    expect(getDropTargetKey({ type: 'unknown-zone' })).toBeNull()
  })

  it('returns type string for zones without custom getTargetKey', () => {
    expect(getDropTargetKey({ type: TRASH_DROP_ZONE_TYPE })).toBe(TRASH_DROP_ZONE_TYPE)
    expect(getDropTargetKey({ type: EMPTY_EDITOR_DROP_TYPE })).toBe(EMPTY_EDITOR_DROP_TYPE)
    expect(getDropTargetKey({ type: SIDEBAR_ROOT_DROP_TYPE })).toBe(SIDEBAR_ROOT_DROP_TYPE)
  })

  it('returns a source-and-block-scoped custom key for empty embed zones', () => {
    expect(
      getDropTargetKey({
        type: EMPTY_EMBED_DROP_TYPE,
        sourceItemId: 'note_5',
        embedBlockId: 'block_1',
      }),
    ).toBe('empty-embed:note_5:block_1')
  })

  it('returns null when empty embed required ids are missing', () => {
    expect(getDropTargetKey({ type: EMPTY_EMBED_DROP_TYPE })).toBeNull()
    expect(getDropTargetKey({ type: EMPTY_EMBED_DROP_TYPE, sourceItemId: 'note_5' })).toBeNull()
    expect(getDropTargetKey({ type: EMPTY_EMBED_DROP_TYPE, embedBlockId: 'block_1' })).toBeNull()
  })

  it('returns custom key for canvas zone', () => {
    expect(getDropTargetKey({ type: CANVAS_DROP_ZONE_TYPE, canvasId: 'canvas_5' })).toBe(
      'canvas:canvas_5',
    )
  })

  it('returns custom key for map zone', () => {
    expect(getDropTargetKey({ type: MAP_DROP_ZONE_TYPE, mapId: 'map_5' })).toBe('map:map_5')
  })

  it('returns custom key for note editor zone', () => {
    expect(getDropTargetKey({ type: NOTE_EDITOR_DROP_TYPE, noteId: 'note_5' })).toBe('note:note_5')
  })

  it('returns null for malformed id-based drop targets', () => {
    expect(getDropTargetKey({ type: CANVAS_DROP_ZONE_TYPE })).toBeNull()
    expect(getDropTargetKey({ type: MAP_DROP_ZONE_TYPE })).toBeNull()
    expect(getDropTargetKey({ type: NOTE_EDITOR_DROP_TYPE })).toBeNull()
    expect(getDropTargetKey({ type: RESOURCE_TYPES.folders })).toBeNull()
  })

  it('returns a namespaced sidebar item key for folder target', () => {
    expect(
      getDropTargetKey({
        type: RESOURCE_TYPES.folders,
        sidebarItemId: 'folder_1',
      }),
    ).toBe('sidebar-item:folder_1')
  })
})

// ─── resolved getDropTargetKey ─────────────────────────────────────

describe('getDropTargetKey for resolved targets', () => {
  it('returns null for null target', () => {
    expect(getDropTargetKey(null)).toBeNull()
  })

  it('returns zone type for trash', () => {
    expect(getDropTargetKey(trashTarget())).toBe(TRASH_DROP_ZONE_TYPE)
  })

  it('returns zone type for empty editor', () => {
    expect(getDropTargetKey(emptyEditorTarget())).toBe(EMPTY_EDITOR_DROP_TYPE)
  })

  it('returns source-and-block-scoped highlight id for empty embed', () => {
    expect(getDropTargetKey(emptyEmbedTarget(testId<'sidebarItems'>('note_7'), 'block_7'))).toBe(
      'empty-embed:note_7:block_7',
    )
  })

  it('returns zone type for root', () => {
    expect(getDropTargetKey(rootTarget())).toBe(SIDEBAR_ROOT_DROP_TYPE)
  })

  it('returns canvas:id for canvas zone', () => {
    expect(getDropTargetKey(canvasTarget(testId<'sidebarItems'>('canvas_7')))).toBe(
      'canvas:canvas_7',
    )
  })

  it('returns map:id for map zone', () => {
    expect(getDropTargetKey(mapTarget(testId<'sidebarItems'>('map_7')))).toBe('map:map_7')
  })

  it('returns a namespaced sidebar item id for folder target', () => {
    const target = folderTarget()
    expect(getDropTargetKey(target)).toBe(`sidebar-item:${target.id}`)
  })
})

// ─── resolveDropTarget ─────────────────────────────────────────────

describe('resolveDropTarget', () => {
  it('resolves sidebar item from the catalog active collection', () => {
    const folder = createFolder()
    const note = createNote({ parentId: folder.id })

    const result = resolveDropTarget(
      { sidebarItemId: note.id },
      testCatalog({ activeItems: [folder, note] }),
    )

    expect(result).toMatchObject({ id: note.id, type: note.type })
    expect((result as { ancestorIds: Array<string> }).ancestorIds).toEqual([folder.id])
  })

  it('resolves sidebar item from the catalog trash collection', () => {
    const note = createNote({ status: 'trashed' })

    const result = resolveDropTarget(
      { sidebarItemId: note.id },
      testCatalog({ trashItems: [note] }),
    )

    expect(result).toMatchObject({ id: note.id })
  })

  it('returns null for unknown sidebar item id', () => {
    const result = resolveDropTarget({ sidebarItemId: 'note_unknown' }, testCatalog())

    expect(result).toBeNull()
  })

  it('passes through known zone types', () => {
    const raw = { type: TRASH_DROP_ZONE_TYPE }
    const result = resolveDropTarget(raw, testCatalog())

    expect(result).toEqual(raw)
  })

  it('passes through canvas zone type', () => {
    const raw = { type: CANVAS_DROP_ZONE_TYPE, canvasId: 'canvas_1' }
    const result = resolveDropTarget(raw, testCatalog())

    expect(result).toEqual(raw)
  })

  it('preserves runtime scope when resolving custom zone targets', () => {
    const raw = {
      type: NOTE_EDITOR_DROP_TYPE,
      noteId: 'note_1',
      __wizardArchiveDndRuntimeId: 'runtime-a',
    }
    const result = resolveDropTarget(raw, testCatalog())

    expect(result).toEqual(raw)
    expect(getDropTargetKey(result as Record<string, unknown>)).toBe(
      'runtime:runtime-a:note:note_1',
    )
  })
  it('resolves empty embed zone data with source and block ids', () => {
    const raw = { type: EMPTY_EMBED_DROP_TYPE, sourceItemId: 'note_1', embedBlockId: 'block_1' }
    const result = resolveDropTarget(raw, testCatalog())

    expect(result).toEqual(raw)
  })

  it('returns null for known zones missing required ids', () => {
    expect(resolveDropTarget({ type: CANVAS_DROP_ZONE_TYPE }, testCatalog())).toBeNull()
    expect(resolveDropTarget({ type: MAP_DROP_ZONE_TYPE }, testCatalog())).toBeNull()
    expect(resolveDropTarget({ type: NOTE_EDITOR_DROP_TYPE }, testCatalog())).toBeNull()
    expect(resolveDropTarget({ type: EMPTY_EMBED_DROP_TYPE }, testCatalog())).toBeNull()
    expect(
      resolveDropTarget({ type: EMPTY_EMBED_DROP_TYPE, sourceItemId: undefined }, testCatalog()),
    ).toBeNull()
    expect(
      resolveDropTarget({ type: EMPTY_EMBED_DROP_TYPE, sourceItemId: 'note_1' }, testCatalog()),
    ).toBeNull()
  })

  it('returns null for unknown zone type', () => {
    const result = resolveDropTarget({ type: 'something-unknown' }, testCatalog())

    expect(result).toBeNull()
  })

  it('returns null for data with no type and no sidebarItemId', () => {
    const result = resolveDropTarget({ foo: 'bar' }, testCatalog())

    expect(result).toBeNull()
  })
})

// ─── Batch Commands ────────────────────────────────────────────────

describe('batch commands', () => {
  it('trash operation returns a batch trash command', () => {
    const note = createNote()
    const ctx = createCtx()
    const result = resolveTestDropCommand([note], trashTarget(), ctx)

    expect(result).toMatchObject({
      status: 'ready',
      plan: {
        command: { type: 'trash', itemIds: [note.id] },
      },
    })
  })

  it('root move operation returns a batch move command with null parentId', () => {
    const note = createNote({ parentId: testId<'sidebarItems'>('folder_1') })
    const ctx = createCtx()
    const result = resolveTestDropCommand([note], rootTarget(), ctx)

    expect(result).toMatchObject({
      status: 'ready',
      plan: {
        command: { type: 'move', itemIds: [note.id], targetParentId: null },
      },
    })
  })

  it('folder move operation returns a batch move command for the folder parentId', () => {
    const note = createNote()
    const target = folderTarget()
    const ctx = createCtx()
    const result = resolveTestDropCommand([note], target, ctx)

    expect(result).toMatchObject({
      status: 'ready',
      plan: {
        command: { type: 'move', itemIds: [note.id], targetParentId: target.id },
      },
    })
  })

  it('restore to root returns a batch restore command', () => {
    const note = createNote({ status: 'trashed' })
    const ctx = createCtx()
    const result = resolveTestDropCommand([note], rootTarget(), ctx)

    expect(result).toMatchObject({
      status: 'ready',
      plan: {
        command: { type: 'restore', itemIds: [note.id], targetParentId: null },
      },
    })
  })

  it('restore to folder returns a batch restore command for the folder parentId', () => {
    const note = createNote({ status: 'trashed' })
    const target = folderTarget()
    const ctx = createCtx()
    const result = resolveTestDropCommand([note], target, ctx)

    expect(result).toMatchObject({
      status: 'ready',
      plan: {
        command: { type: 'restore', itemIds: [note.id], targetParentId: target.id },
      },
    })
  })

  it('empty editor open is DnD feedback, not a filesystem command', () => {
    const note = createNote()
    const ctx = createCtx()

    expect(resolveTestDropCommand([note], emptyEditorTarget(), ctx)).toEqual({ status: 'noop' })
    expect(resolveDropOutcome(note, emptyEditorTarget(), ctx)).toMatchObject({
      type: 'operation',
      action: 'open',
    })
  })

  it('pin operation is handled by the monitor', () => {
    const note = createNote()
    const result = resolveDropOutcome(note, mapTarget(), createCtx())

    expect(result).toMatchObject({ type: 'operation', action: 'pin' })
  })

  it('link operation is handled by the monitor', () => {
    const note = createNote()
    const result = resolveDropOutcome(note, noteEditorTarget(), createCtx())

    expect(result).toMatchObject({ type: 'operation', action: 'link' })
  })
})
