import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  createNoteViaFilesystem,
  createFolderViaFilesystem,
  createFileViaFilesystem,
  createGameMapViaFilesystem,
  createCanvasViaFilesystem,
} from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { testId } from '../../_test/test-id.helper'
import {
  coerceSidebarItemColorForInput,
  parseSidebarItemColor,
  validateSidebarItemColor,
} from '../../../shared/sidebar-items/color'
import {
  coerceSidebarItemIconNameForInput,
  parseSidebarItemIconName,
  validateSidebarItemIconName,
} from '../../../shared/sidebar-items/icon'
import {
  checkNameConflict,
  validateItemName,
  validateSidebarItemNameWithSiblings,
} from '../../../shared/sidebar-items/name'
import {
  getAncestorIds,
  validateCreateParentTarget,
  validateNoCircularParent,
  validateNoCircularParentAsync,
} from '../../../shared/sidebar-items/parent-target'
import { validateSidebarItemSlug } from '../../../shared/sidebar-items/slug'
import type { Id } from '../../_generated/dataModel'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import type { AnySidebarItem } from '../types/types'

describe('validateItemName', () => {
  it('accepts a valid name', () => {
    expect(validateItemName('My Note')).toEqual({ valid: true })
  })

  it('rejects empty string', () => {
    const result = validateItemName('')
    expect(result.valid).toBe(false)
  })

  it('rejects whitespace-only string', () => {
    const result = validateItemName('   ')
    expect(result.valid).toBe(false)
  })

  it('accepts exactly 255 characters', () => {
    const name = 'a'.repeat(255)
    expect(validateItemName(name)).toEqual({ valid: true })
  })

  it('rejects 256 characters', () => {
    const name = 'a'.repeat(256)
    const result = validateItemName(name)
    expect(result.valid).toBe(false)
  })

  it('rejects forward slash', () => {
    expect(validateItemName('a/b').valid).toBe(false)
  })

  it('rejects backslash', () => {
    expect(validateItemName('a\\b').valid).toBe(false)
  })

  it('rejects colon', () => {
    expect(validateItemName('a:b').valid).toBe(false)
  })

  it('rejects asterisk', () => {
    expect(validateItemName('a*b').valid).toBe(false)
  })

  it('rejects question mark', () => {
    expect(validateItemName('a?b').valid).toBe(false)
  })

  it('rejects double quote', () => {
    expect(validateItemName('a"b').valid).toBe(false)
  })

  it('rejects angle brackets', () => {
    expect(validateItemName('a<b').valid).toBe(false)
    expect(validateItemName('a>b').valid).toBe(false)
  })

  it('rejects square brackets', () => {
    expect(validateItemName('a[b').valid).toBe(false)
    expect(validateItemName('a]b').valid).toBe(false)
  })

  it('rejects hash', () => {
    expect(validateItemName('a#b').valid).toBe(false)
  })

  it('rejects pipe', () => {
    expect(validateItemName('a|b').valid).toBe(false)
  })

  it('rejects leading dot', () => {
    expect(validateItemName('.hidden').valid).toBe(false)
  })

  it('rejects trailing dot', () => {
    expect(validateItemName('file.').valid).toBe(false)
  })

  it('rejects names that start or end with whitespace', () => {
    expect(validateItemName(' name').valid).toBe(false)
    expect(validateItemName('name ').valid).toBe(false)
  })

  it('rejects control characters', () => {
    expect(validateItemName('line\nbreak').valid).toBe(false)
  })

  it('rejects names that would produce an empty slug', () => {
    expect(validateItemName('🎉🎊').valid).toBe(false)
  })
})

describe('validateSidebarItemSlug', () => {
  it('accepts a valid slug', () => {
    expect(validateSidebarItemSlug('my-note')).toBeNull()
  })

  it('rejects empty string', () => {
    expect(validateSidebarItemSlug('')).not.toBeNull()
  })

  it('accepts single-character slugs', () => {
    expect(validateSidebarItemSlug('a')).toBeNull()
  })

  it('rejects uppercase letters', () => {
    expect(validateSidebarItemSlug('My-Note')).not.toBeNull()
  })

  it('rejects spaces', () => {
    expect(validateSidebarItemSlug('my note')).not.toBeNull()
  })

  it('accepts underscores', () => {
    expect(validateSidebarItemSlug('my_note')).toBeNull()
  })

  it('rejects consecutive separators', () => {
    expect(validateSidebarItemSlug('my--note')).not.toBeNull()
    expect(validateSidebarItemSlug('my-_note')).not.toBeNull()
  })

  it('rejects leading or trailing separators', () => {
    expect(validateSidebarItemSlug('-note')).not.toBeNull()
    expect(validateSidebarItemSlug('note-')).not.toBeNull()
    expect(validateSidebarItemSlug('_note')).not.toBeNull()
    expect(validateSidebarItemSlug('note_')).not.toBeNull()
  })

  it('accepts exactly 255 characters', () => {
    const slug = 'a'.repeat(255)
    expect(validateSidebarItemSlug(slug)).toBeNull()
  })

  it('rejects 256 characters', () => {
    const slug = 'a'.repeat(256)
    expect(validateSidebarItemSlug(slug)).not.toBeNull()
  })
})

describe('sidebar item color validation', () => {
  it('parses valid colors and normalizes them to lowercase', () => {
    expect(parseSidebarItemColor('#ABCDEF')).toBe('#abcdef')
    expect(parseSidebarItemColor('#ABCDEF80')).toBe('#abcdef80')
  })

  it('rejects invalid colors', () => {
    expect(parseSidebarItemColor('abcdef')).toBeNull()
    expect(validateSidebarItemColor('#FFF')).toBe('Color must be a 6- or 8-digit hex value')
    expect(validateSidebarItemColor('')).toBe('Color must be a 6- or 8-digit hex value')
  })
})

describe('sidebar item icon validation', () => {
  it('accepts supported icon names', () => {
    expect(parseSidebarItemIconName('Shield')).toBe('Shield')
    expect(parseSidebarItemIconName('Grid2x2Plus')).toBe('Grid2x2Plus')
  })

  it('rejects unsupported icon names', () => {
    expect(parseSidebarItemIconName('Nope')).toBeNull()
    expect(validateSidebarItemIconName('Nope')).toBe('Icon is not supported')
  })
})

describe('checkNameConflict', () => {
  const siblings = [
    { _id: testId<'sidebarItems'>('id1'), name: 'Alpha' },
    { _id: testId<'sidebarItems'>('id2'), name: 'Beta' },
  ]

  it('returns valid when no conflict', () => {
    expect(checkNameConflict('Gamma', siblings)).toEqual({ valid: true })
  })

  it('detects case-insensitive match', () => {
    const result = checkNameConflict('alpha', siblings)
    expect(result.valid).toBe(false)
  })

  it('excludes self from conflict check', () => {
    const result = checkNameConflict('Alpha', siblings, testId<'sidebarItems'>('id1'))
    expect(result).toEqual({ valid: true })
  })
})

describe('validateSidebarItemNameWithSiblings', () => {
  const siblings = [
    { _id: testId<'sidebarItems'>('id1'), name: 'Alpha' },
    { _id: testId<'sidebarItems'>('id2'), name: 'Beta' },
  ]

  it('validates format-only names when no siblings are provided', () => {
    expect(validateSidebarItemNameWithSiblings('Gamma')).toEqual({ valid: true })
  })

  it('checks sibling conflicts after trimming', () => {
    const result = validateSidebarItemNameWithSiblings(' alpha ', siblings)
    expect(result.valid).toBe(false)
  })

  it('ignores the excluded item when checking conflicts', () => {
    expect(
      validateSidebarItemNameWithSiblings('Alpha', siblings, testId<'sidebarItems'>('id1')),
    ).toEqual({ valid: true })
  })
})

describe('validateNoCircularParent', () => {
  const folder = (parentId: string | null) => ({
    parentId: parentId ? testId<'sidebarItems'>(parentId) : null,
  })

  it('returns valid for null parent', () => {
    const result = validateNoCircularParent(testId<'sidebarItems'>('f1'), null, () => undefined)
    expect(result).toEqual({ valid: true })
  })

  it('rejects item as its own parent', () => {
    const result = validateNoCircularParent(
      testId<'sidebarItems'>('f1'),
      testId<'sidebarItems'>('f1'),
      () => undefined,
    )
    expect(result.valid).toBe(false)
  })

  it('detects ancestor cycle', () => {
    const tree: Record<string, { parentId: Id<'sidebarItems'> | null }> = {
      f2: folder('f3'),
      f3: folder('f1'),
    }
    const result = validateNoCircularParent(
      testId<'sidebarItems'>('f1'),
      testId<'sidebarItems'>('f2'),
      (id) => tree[id],
    )
    expect(result.valid).toBe(false)
  })

  it('allows deep chain with no cycle', () => {
    const tree: Record<string, { parentId: Id<'sidebarItems'> | null }> = {
      f2: folder('f3'),
      f3: folder('f4'),
      f4: folder(null),
    }
    const result = validateNoCircularParent(
      testId<'sidebarItems'>('f1'),
      testId<'sidebarItems'>('f2'),
      (id) => tree[id],
    )
    expect(result).toEqual({ valid: true })
  })

  it('breaks on circular data via seen set', () => {
    const tree: Record<string, { parentId: Id<'sidebarItems'> | null }> = {
      f2: folder('f3'),
      f3: folder('f2'),
    }
    const result = validateNoCircularParent(
      testId<'sidebarItems'>('f1'),
      testId<'sidebarItems'>('f2'),
      (id) => tree[id],
    )
    expect(result).toEqual({ valid: true })
  })

  it('supports async parent lookups with the same behavior', async () => {
    const tree: Record<string, { parentId: Id<'sidebarItems'> | null }> = {
      f2: folder('f3'),
      f3: folder('f1'),
    }
    const result = await validateNoCircularParentAsync(
      testId<'sidebarItems'>('f1'),
      testId<'sidebarItems'>('f2'),
      (id) => Promise.resolve(tree[id]),
    )
    expect(result.valid).toBe(false)
  })
})

describe('getAncestorIds', () => {
  const folder = (parentId: string | null) => ({
    parentId: parentId ? testId<'sidebarItems'>(parentId) : null,
  })

  it('returns ancestors in nearest-first order', () => {
    const tree: Record<string, { parentId: Id<'sidebarItems'> | null }> = {
      note: folder('f2'),
      f2: folder('f3'),
      f3: folder(null),
    }
    expect(getAncestorIds(testId<'sidebarItems'>('note'), (id) => tree[id])).toEqual([
      testId<'sidebarItems'>('f2'),
      testId<'sidebarItems'>('f3'),
    ])
  })

  it('returns empty when the item is missing', () => {
    expect(getAncestorIds(testId<'sidebarItems'>('missing'), () => undefined)).toEqual([])
  })
})

describe('validateCreateParentTarget', () => {
  function createValidationItem(
    id: string,
    type: AnySidebarItem['type'],
    parentId: Id<'sidebarItems'> | null = null,
  ): AnySidebarItem {
    return {
      _id: testId<'sidebarItems'>(id),
      type,
      parentId,
      name: id,
    } as unknown as AnySidebarItem
  }

  it('rejects path targets whose base parent is not a folder', () => {
    const noteId = testId<'sidebarItems'>('note-parent')
    const noteParent = {
      _id: noteId,
      type: SIDEBAR_ITEM_TYPES.notes,
      parentId: null,
      name: 'Leaf Note',
    } as unknown as AnySidebarItem

    const result = validateCreateParentTarget(
      {
        kind: 'path',
        baseParentId: noteId,
        pathSegments: [],
      },
      new Map([[noteId, noteParent]]),
      new Map([[null, [noteParent]]]),
    )

    expect(result).toEqual({
      valid: false,
      error: 'Parent is not a folder',
    })
  })

  it('accepts a path target whose base parent is a folder', () => {
    const folder = createValidationItem('folder-parent', SIDEBAR_ITEM_TYPES.folders)
    const child = createValidationItem('folder-child', SIDEBAR_ITEM_TYPES.notes, folder._id)

    const result = validateCreateParentTarget(
      {
        kind: 'path',
        baseParentId: folder._id,
        pathSegments: [],
      },
      new Map([[folder._id, folder]]),
      new Map([[folder._id, [child]]]),
    )

    expect(result).toEqual({
      valid: true,
      parentId: folder._id,
      siblings: [child],
    })
  })

  it('uses root siblings when a root path target has no segments', () => {
    const first = createValidationItem('first-root-child', SIDEBAR_ITEM_TYPES.notes)
    const second = createValidationItem('second-root-child', SIDEBAR_ITEM_TYPES.folders)

    const result = validateCreateParentTarget(
      {
        kind: 'path',
        baseParentId: null,
        pathSegments: [],
      },
      new Map([
        [first._id, first],
        [second._id, second],
      ]),
      new Map([[null, [first, second]]]),
    )

    expect(result).toEqual({
      valid: true,
      parentId: null,
      siblings: [first, second],
    })
  })

  it('rejects missing base parents', () => {
    expect(
      validateCreateParentTarget(
        {
          kind: 'path',
          baseParentId: testId<'sidebarItems'>('missing-parent'),
          pathSegments: [],
        },
        new Map(),
        new Map(),
      ),
    ).toEqual({ valid: false, error: 'Parent not found' })
  })

  it('rejects empty path segments', () => {
    expect(
      validateCreateParentTarget(
        {
          kind: 'path',
          baseParentId: null,
          pathSegments: [''],
        },
        new Map(),
        new Map(),
      ),
    ).toEqual({ valid: false, error: 'Path segments cannot be empty' })
  })
})

describe('cross-table slug uniqueness', () => {
  const t = createTestContext()

  it('assigns different slugs when note and folder share a name in different parents', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'container',
    })

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'test',
      slug: 'test',
      parentId: folderId,
    })

    const result = await createFolderViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'test',
      parentTarget: { kind: 'direct', parentId: null },
    })

    expect(result.slug).toBe('test-1')
  })

  it('allows same slug in different campaigns', async () => {
    const ctx1 = await setupCampaignContext(t)
    const ctx2 = await setupCampaignContext(t)
    const dm1 = asDm(ctx1)
    const dm2 = asDm(ctx2)

    await createNote(t, ctx1.campaignId, ctx1.dm.profile._id, {
      name: 'shared-name',
      slug: 'shared-name',
    })

    await createNote(t, ctx2.campaignId, ctx2.dm.profile._id, {
      name: 'shared-name',
      slug: 'shared-name',
    })

    const item1 = await dm1.query(api.sidebarItems.queries.getSidebarItemBySlug, {
      campaignId: ctx1.campaignId,
      slug: 'shared-name',
    })
    const item2 = await dm2.query(api.sidebarItems.queries.getSidebarItemBySlug, {
      campaignId: ctx2.campaignId,
      slug: 'shared-name',
    })

    expect(item1).not.toBeNull()
    expect(item2).not.toBeNull()
  })

  it('collides with soft-deleted item slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'deleted-item',
      slug: 'deleted-item',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
      status: 'trashed',
    })

    const result = await createFolderViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'deleted-item',
      parentTarget: { kind: 'direct', parentId: null },
    })

    expect(result.slug).toBe('deleted-item-1')
  })

  it('rejects invalid slugs at the query boundary', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expect(
      dmAuth.query(api.sidebarItems.queries.getSidebarItemBySlug, {
        campaignId: ctx.campaignId,
        slug: 'bad slug',
      }),
    ).rejects.toThrow('Slug cannot contain spaces')
  })

  it('rejects create requests whose names cannot produce a valid slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expect(
      createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: '🎉🎊',
        parentTarget: { kind: 'direct', parentId: null },
        content: [],
      }),
    ).rejects.toThrow('Name must contain at least one letter or number')
  })

  it('keeps generated slugs valid for max-length names', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const firstName = 'a'.repeat(255)
    const secondName = `${'a'.repeat(253)} 2`

    const first = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: firstName,
      parentTarget: { kind: 'direct', parentId: null },
      content: [],
    })

    const second = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: secondName,
      parentTarget: { kind: 'direct', parentId: null },
      content: [],
    })

    expect(validateSidebarItemSlug(first.slug)).toBeNull()
    expect(validateSidebarItemSlug(second.slug)).toBeNull()
    expect(first.slug.length).toBeLessThanOrEqual(255)
    expect(second.slug.length).toBeLessThanOrEqual(255)
  })

  it('rejects invalid note colors at the mutation boundary', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        command: {
          type: 'create',
          itemType: SIDEBAR_ITEM_TYPES.notes,
          name: 'bad-color-note',
          parentTarget: { kind: 'direct', parentId: null },
          color: 'red' as never,
        },
      }),
    ).rejects.toThrow('Color must be a 6- or 8-digit hex value')
  })

  it('rejects invalid folder icons at the mutation boundary', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const folder = await createFolderViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'folder-to-update',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        command: {
          type: 'rename',
          itemId: folder.folderId,
          iconName: 'InvalidIcon' as never,
        },
      }),
    ).rejects.toThrow('Icon is not supported')
  })

  it('stores file colors in lowercase canonical form', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await createFileViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'file-with-color',
      parentTarget: { kind: 'direct', parentId: null },
      iconName: 'Shield',
      color: coerceSidebarItemColorForInput('#ABCDEF'),
    })

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItemBySlug, {
      campaignId: ctx.campaignId,
      slug: result.slug,
    })

    expect(item?.iconName).toBe('Shield')
    expect(item?.color).toBe('#abcdef')
  })

  it('stores updated map colors in lowercase canonical form', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const map = await createGameMapViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'map-color',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
      campaignId: ctx.campaignId,
      command: {
        type: 'rename',
        itemId: map.mapId,
        iconName: 'Grid2x2Plus',
        color: '#ABCDEF80',
      },
    })

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItemBySlug, {
      campaignId: ctx.campaignId,
      slug: map.slug,
    })

    expect(item?.iconName).toBe('Grid2x2Plus')
    expect(item?.color).toBe('#abcdef80')
  })

  it('rejects invalid canvas colors at the mutation boundary', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const canvas = await createCanvasViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'canvas-to-update',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        command: {
          type: 'rename',
          itemId: canvas.canvasId,
          color: '#12' as never,
        },
      }),
    ).rejects.toThrow('Color must be a 6- or 8-digit hex value')
  })
})

describe('input coercion helpers', () => {
  it('coerces valid icon and color inputs', () => {
    expect(coerceSidebarItemIconNameForInput('Shield')).toBe('Shield')
    expect(coerceSidebarItemColorForInput('#ABCDEF')).toBe('#abcdef')
    expect(coerceSidebarItemIconNameForInput(null)).toBeNull()
    expect(coerceSidebarItemColorForInput(undefined)).toBeUndefined()
  })

  it('throws the same validation errors for invalid icon and color inputs', () => {
    expect(() => coerceSidebarItemIconNameForInput('Nope')).toThrow('Icon is not supported')
    expect(() => coerceSidebarItemColorForInput('#FFF')).toThrow(
      'Color must be a 6- or 8-digit hex value',
    )
  })
})
