import { describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type {
  CanvasDropZoneData,
  DndContext,
  EmptyEditorDropZoneData,
  MapDropZoneData,
  NoteEditorDropZoneData,
  ResolvedSidebarItemDropData,
  SidebarRootDropZoneData,
  TrashDropZoneData,
} from '~/features/dnd/utils/dnd-registry'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '~/test/factories/sidebar-item-factory'
import {
  CANVAS_DROP_ZONE_TYPE,
  EMPTY_EDITOR_DROP_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
  TRASH_DROP_ZONE_TYPE,
  canDropFilesOnTarget,
  getDragItemId,
  getDropTargetKey,
  getHighlightId,
  rejectionReasonMessage,
  resolveDropOutcome,
  resolveDropTarget,
} from '~/features/dnd/utils/dnd-registry'
import { testId } from '~/test/helpers/test-id'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function createCtx(overrides?: Partial<DndContext>): DndContext {
  return {
    moveItem: vi.fn(),
    navigateToItem: vi.fn(),
    campaignId: testId<'campaigns'>('campaign_1'),
    campaignName: 'Test Campaign',
    isDm: true,
    setFolderOpen: vi.fn(),
    hasSiblingNameConflict: () => false,
    ...overrides,
  }
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

function noteEditorTarget(noteId = testId<'notes'>('note_99')): NoteEditorDropZoneData {
  return { type: NOTE_EDITOR_DROP_TYPE, noteId }
}

function mapTarget(
  mapId = testId<'gameMaps'>('map_99'),
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

function canvasTarget(canvasId = testId<'canvases'>('canvas_99')): CanvasDropZoneData {
  return { type: CANVAS_DROP_ZONE_TYPE, canvasId }
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

// ─── rejectionReasonMessage ────────────────────────────────────────

describe('rejectionReasonMessage', () => {
  it('returns message for each rejection reason', () => {
    expect(rejectionReasonMessage('no_permission')).toBe('No permission to move here')
    expect(rejectionReasonMessage('circular')).toBe('Cannot move folder into itself')
    expect(rejectionReasonMessage('self_pin')).toBe('Cannot pin map to itself')
    expect(rejectionReasonMessage('self_embed')).toBe('Cannot embed canvas into itself')
    expect(rejectionReasonMessage('already_pinned')).toBe('Already pinned to this map')
    expect(rejectionReasonMessage('not_folder')).toBe('Cannot drop here')
    expect(rejectionReasonMessage('missing_data')).toBe('Missing data')
    expect(rejectionReasonMessage('trashed_folder')).toBe('Trashed folders are uneditable')
    expect(rejectionReasonMessage('name_conflict')).toBe(
      'An item with this name already exists here',
    )
    expect(rejectionReasonMessage('dm_only')).toBe('Only the DM can do this')
    expect(rejectionReasonMessage('trashed_item')).toBe('The item is trashed and cannot be used')
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

    expect(result).toEqual({ type: 'rejection', reason: 'no_permission' })
  })

  it('rejects trash when item lacks FULL_ACCESS', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.VIEW })
    const result = resolveDropOutcome(note, trashTarget(), createCtx())

    expect(result).toEqual({ type: 'rejection', reason: 'no_permission' })
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
      const note = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })
      const result = resolveDropOutcome(note, trashTarget(), createCtx())

      expect(result).toBeNull()
    })

    it('rejects trashing a folder as non-DM', () => {
      const folder = createFolder()
      const ctx = createCtx({ isDm: false })
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
      const note = createNote({ parentId: testId<'folders'>('folder_1') })
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
      const note = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })
      const result = resolveDropOutcome(note, rootTarget(), createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'restore' })
    })

    it('rejects restore when name conflicts at root', () => {
      const note = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })
      const ctx = createCtx({ hasSiblingNameConflict: () => true })
      const result = resolveDropOutcome(note, rootTarget(), ctx)

      expect(result).toEqual({ type: 'rejection', reason: 'name_conflict' })
    })

    it('rejects move when name conflicts at root', () => {
      const note = createNote({ parentId: testId<'folders'>('folder_1') })
      const ctx = createCtx({ hasSiblingNameConflict: () => true })
      const result = resolveDropOutcome(note, rootTarget(), ctx)

      expect(result).toEqual({ type: 'rejection', reason: 'name_conflict' })
    })

    it('rejects restoring a folder as non-DM', () => {
      const folder = createFolder({ location: SIDEBAR_ITEM_LOCATION.trash })
      const ctx = createCtx({ isDm: false })
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
        _id: folder._id,
      } satisfies Partial<ResolvedSidebarItemDropData>)
      const result = resolveDropOutcome(folder, target, createCtx())

      expect(result).toBeNull()
    })

    it('returns null when item is already in target folder', () => {
      const target = folderTarget()
      const note = createNote({ parentId: testId<'folders'>(target._id) })
      const result = resolveDropOutcome(note, target, createCtx())

      expect(result).toBeNull()
    })

    it('rejects drop on trashed folder', () => {
      const note = createNote()
      const target = folderTarget({
        location: SIDEBAR_ITEM_LOCATION.trash,
      } satisfies Partial<ResolvedSidebarItemDropData>)
      const result = resolveDropOutcome(note, target, createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'trashed_folder' })
    })

    it('rejects circular move (folder into its descendant)', () => {
      const folder = createFolder()
      const target = folderTarget({
        ancestorIds: [folder._id],
      })
      const result = resolveDropOutcome(folder, target, createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'circular' })
    })

    it('does not reject circular for non-folder items', () => {
      const note = createNote()
      const target = folderTarget({
        ancestorIds: [testId<'folders'>(note._id)],
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

      expect(result).toEqual({ type: 'rejection', reason: 'no_permission' })
    })

    it('allows restoring trashed item into folder', () => {
      const note = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })
      const target = folderTarget()
      const result = resolveDropOutcome(note, target, createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'restore' })
    })

    it('rejects restoring when name conflicts in target folder', () => {
      const note = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })
      const target = folderTarget()
      const ctx = createCtx({ hasSiblingNameConflict: () => true })
      const result = resolveDropOutcome(note, target, ctx)

      expect(result).toEqual({ type: 'rejection', reason: 'name_conflict' })
    })

    it('rejects restoring a folder as non-DM', () => {
      const folder = createFolder({ location: SIDEBAR_ITEM_LOCATION.trash })
      const target = folderTarget()
      const ctx = createCtx({ isDm: false })
      const result = resolveDropOutcome(folder, target, ctx)

      expect(result).toEqual({ type: 'rejection', reason: 'dm_only' })
    })

    it('rejects move when name conflicts in target folder', () => {
      const note = createNote()
      const target = folderTarget()
      const ctx = createCtx({ hasSiblingNameConflict: () => true })
      const result = resolveDropOutcome(note, target, ctx)

      expect(result).toEqual({ type: 'rejection', reason: 'name_conflict' })
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
      const target = mapTarget(map._id)
      const result = resolveDropOutcome(map, target, createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'self_pin' })
    })

    it('rejects pinning an already-pinned item', () => {
      const note = createNote()
      const target = mapTarget(testId<'gameMaps'>('map_99'), {
        pinnedItemIds: [note._id],
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

    it('rejects linking a trashed item', () => {
      const note = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })
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
      const target = canvasTarget(testId<'canvases'>(canvas._id))
      const result = resolveDropOutcome(canvas, target, createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'self_embed' })
    })

    it('rejects embedding a trashed item', () => {
      const note = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })
      const result = resolveDropOutcome(note, canvasTarget(), createCtx())

      expect(result).toEqual({ type: 'rejection', reason: 'trashed_item' })
    })

    it('allows embed even without FULL_ACCESS', () => {
      const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.VIEW })
      const result = resolveDropOutcome(note, canvasTarget(), createCtx())

      expect(result?.type).toBe('operation')
      expect((result as { action: string }).action).toBe('embed')
    })

    it('embed operation has null execute (handled by monitor)', () => {
      const note = createNote()
      const result = resolveDropOutcome(note, canvasTarget(), createCtx())

      expect(result).toMatchObject({ type: 'operation', action: 'embed' })
      expect((result as { execute: null }).execute).toBeNull()
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

// ─── canDropFilesOnTarget ──────────────────────────────────────────

describe('canDropFilesOnTarget', () => {
  it('returns false for null target', () => {
    expect(canDropFilesOnTarget(null)).toBe(false)
  })

  it('returns false for trash zone', () => {
    expect(canDropFilesOnTarget(trashTarget())).toBe(false)
  })

  it('returns false for map zone', () => {
    expect(canDropFilesOnTarget(mapTarget())).toBe(false)
  })

  it('returns true for canvas zone', () => {
    expect(canDropFilesOnTarget(canvasTarget())).toBe(true)
  })

  it('returns false for note editor zone', () => {
    expect(canDropFilesOnTarget(noteEditorTarget())).toBe(false)
  })

  it('returns true for empty editor zone', () => {
    expect(canDropFilesOnTarget(emptyEditorTarget())).toBe(true)
  })

  it('returns true for root zone', () => {
    expect(canDropFilesOnTarget(rootTarget())).toBe(true)
  })

  it('returns true for active folder', () => {
    expect(canDropFilesOnTarget(folderTarget())).toBe(true)
  })

  it('returns false for trashed folder', () => {
    const target = folderTarget({
      location: SIDEBAR_ITEM_LOCATION.trash,
    } satisfies Partial<ResolvedSidebarItemDropData>)
    expect(canDropFilesOnTarget(target)).toBe(false)
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

  it('returns sidebarItemId for folder target', () => {
    expect(
      getDropTargetKey({
        type: SIDEBAR_ITEM_TYPES.folders,
        sidebarItemId: 'folder_1',
      }),
    ).toBe('folder_1')
  })
})

// ─── getHighlightId ────────────────────────────────────────────────

describe('getHighlightId', () => {
  it('returns null for null target', () => {
    expect(getHighlightId(null)).toBeNull()
  })

  it('returns zone type for trash', () => {
    expect(getHighlightId(trashTarget())).toBe(TRASH_DROP_ZONE_TYPE)
  })

  it('returns zone type for empty editor', () => {
    expect(getHighlightId(emptyEditorTarget())).toBe(EMPTY_EDITOR_DROP_TYPE)
  })

  it('returns zone type for root', () => {
    expect(getHighlightId(rootTarget())).toBe(SIDEBAR_ROOT_DROP_TYPE)
  })

  it('returns canvas:id for canvas zone', () => {
    expect(getHighlightId(canvasTarget(testId<'canvases'>('canvas_7')))).toBe('canvas:canvas_7')
  })

  it('returns map:id for map zone', () => {
    expect(getHighlightId(mapTarget(testId<'gameMaps'>('map_7')))).toBe('map:map_7')
  })

  it('returns item id for folder target', () => {
    const target = folderTarget()
    expect(getHighlightId(target)).toBe(target._id)
  })
})

// ─── resolveDropTarget ─────────────────────────────────────────────

const emptyMap: ReadonlyMap<SidebarItemId, never> = new Map<SidebarItemId, never>()

describe('resolveDropTarget', () => {
  it('resolves sidebar item from itemsMap', () => {
    const note = createNote()
    const itemsMap: ReadonlyMap<SidebarItemId, typeof note> = new Map([[note._id, note]])
    const trashedMap: ReadonlyMap<SidebarItemId, typeof note> = new Map()
    const getAncestorIds = vi.fn(() => [testId<'folders'>('folder_1')])

    const result = resolveDropTarget(
      { sidebarItemId: note._id },
      itemsMap,
      trashedMap,
      getAncestorIds,
    )

    expect(result).toMatchObject({ _id: note._id, type: note.type })
    expect((result as { ancestorIds: Array<string> }).ancestorIds).toEqual(['folder_1'])
  })

  it('resolves sidebar item from trashedItemsMap', () => {
    const note = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })
    const itemsMap: ReadonlyMap<SidebarItemId, typeof note> = new Map()
    const trashedMap: ReadonlyMap<SidebarItemId, typeof note> = new Map([[note._id, note]])
    const getAncestorIds = vi.fn(() => [])

    const result = resolveDropTarget(
      { sidebarItemId: note._id },
      itemsMap,
      trashedMap,
      getAncestorIds,
    )

    expect(result).toMatchObject({ _id: note._id })
  })

  it('returns null for unknown sidebar item id', () => {
    const itemsMap: ReadonlyMap<SidebarItemId, never> = new Map<SidebarItemId, never>()
    const trashedMap: ReadonlyMap<SidebarItemId, never> = new Map<SidebarItemId, never>()

    const result = resolveDropTarget(
      { sidebarItemId: 'note_unknown' },
      itemsMap,
      trashedMap,
      vi.fn(),
    )

    expect(result).toBeNull()
  })

  it('passes through known zone types', () => {
    const raw = { type: TRASH_DROP_ZONE_TYPE }
    const result = resolveDropTarget(raw, emptyMap, emptyMap, vi.fn())

    expect(result).toEqual(raw)
  })

  it('passes through canvas zone type', () => {
    const raw = { type: CANVAS_DROP_ZONE_TYPE, canvasId: 'canvas_1' }
    const result = resolveDropTarget(raw, emptyMap, emptyMap, vi.fn())

    expect(result).toEqual(raw)
  })

  it('returns null for unknown zone type', () => {
    const result = resolveDropTarget({ type: 'something-unknown' }, emptyMap, emptyMap, vi.fn())

    expect(result).toBeNull()
  })

  it('returns null for data with no type and no sidebarItemId', () => {
    const result = resolveDropTarget({ foo: 'bar' }, emptyMap, emptyMap, vi.fn())

    expect(result).toBeNull()
  })
})

// ─── Operation execution ───────────────────────────────────────────

describe('operation execution', () => {
  it('trash operation calls moveItem with trash location', async () => {
    const note = createNote()
    const ctx = createCtx()
    const result = resolveDropOutcome(note, trashTarget(), ctx)

    expect(result?.type).toBe('operation')
    await (result as { execute: () => Promise<void> }).execute()
    expect(ctx.moveItem).toHaveBeenCalledWith(note, {
      location: SIDEBAR_ITEM_LOCATION.trash,
    })
  })

  it('root move operation calls moveItem with null parentId', async () => {
    const note = createNote({ parentId: testId<'folders'>('folder_1') })
    const ctx = createCtx()
    const result = resolveDropOutcome(note, rootTarget(), ctx)

    await (result as { execute: () => Promise<void> }).execute()
    expect(ctx.moveItem).toHaveBeenCalledWith(note, { parentId: null })
  })

  it('folder move operation calls moveItem and opens folder', async () => {
    const note = createNote()
    const target = folderTarget()
    const ctx = createCtx()
    const result = resolveDropOutcome(note, target, ctx)

    await (result as { execute: () => Promise<void> }).execute()
    expect(ctx.moveItem).toHaveBeenCalledWith(note, {
      parentId: target._id,
    })
    expect(ctx.setFolderOpen).toHaveBeenCalledWith(target._id)
  })

  it('restore to root calls moveItem with sidebar location', async () => {
    const note = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })
    const ctx = createCtx()
    const result = resolveDropOutcome(note, rootTarget(), ctx)

    await (result as { execute: () => Promise<void> }).execute()
    expect(ctx.moveItem).toHaveBeenCalledWith(note, {
      parentId: null,
      location: SIDEBAR_ITEM_LOCATION.sidebar,
    })
  })

  it('restore to folder calls moveItem and opens folder', async () => {
    const note = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })
    const target = folderTarget()
    const ctx = createCtx()
    const result = resolveDropOutcome(note, target, ctx)

    await (result as { execute: () => Promise<void> }).execute()
    expect(ctx.moveItem).toHaveBeenCalledWith(note, {
      parentId: target._id,
      location: SIDEBAR_ITEM_LOCATION.sidebar,
    })
    expect(ctx.setFolderOpen).toHaveBeenCalledWith(target._id)
  })

  it('empty editor open calls navigateToItem', async () => {
    const note = createNote()
    const ctx = createCtx()
    const result = resolveDropOutcome(note, emptyEditorTarget(), ctx)

    await (result as { execute: () => Promise<void> }).execute()
    expect(ctx.navigateToItem).toHaveBeenCalledWith(note.slug, true)
  })

  it('pin operation has null execute (handled by monitor)', () => {
    const note = createNote()
    const result = resolveDropOutcome(note, mapTarget(), createCtx())

    expect(result).toMatchObject({ type: 'operation', action: 'pin' })
    expect((result as { execute: null }).execute).toBeNull()
  })

  it('link operation has null execute (handled by monitor)', () => {
    const note = createNote()
    const result = resolveDropOutcome(note, noteEditorTarget(), createCtx())

    expect(result).toMatchObject({ type: 'operation', action: 'link' })
    expect((result as { execute: null }).execute).toBeNull()
  })
})
