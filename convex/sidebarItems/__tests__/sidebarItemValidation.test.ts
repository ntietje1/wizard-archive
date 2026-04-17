import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { testId } from '../../_test/test-id.helper'
import { parseSidebarItemColor, validateSidebarItemColor } from '../color'
import { parseSidebarItemIconName, validateSidebarItemIconName } from '../icon'
import {
  checkNameConflict,
  validateItemName,
  validateItemSlug,
  validateNoCircularParent,
} from '../sharedValidation'
import type { Id } from '../../_generated/dataModel'

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

describe('validateItemSlug', () => {
  it('accepts a valid slug', () => {
    expect(validateItemSlug('my-note')).toEqual({ valid: true })
  })

  it('rejects empty string', () => {
    expect(validateItemSlug('').valid).toBe(false)
  })

  it('rejects uppercase letters', () => {
    expect(validateItemSlug('My-Note').valid).toBe(false)
  })

  it('rejects spaces', () => {
    expect(validateItemSlug('my note').valid).toBe(false)
  })

  it('rejects consecutive hyphens', () => {
    expect(validateItemSlug('my--note').valid).toBe(false)
  })

  it('rejects leading or trailing hyphens', () => {
    expect(validateItemSlug('-note').valid).toBe(false)
    expect(validateItemSlug('note-').valid).toBe(false)
  })

  it('accepts exactly 255 characters', () => {
    const slug = 'a'.repeat(255)
    expect(validateItemSlug(slug)).toEqual({ valid: true })
  })

  it('rejects 256 characters', () => {
    const slug = 'a'.repeat(256)
    expect(validateItemSlug(slug).valid).toBe(false)
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

describe('validateNoCircularParent', () => {
  const folder = (_id: string, parentId: string | null) => ({
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
      f2: folder('f2', 'f3'),
      f3: folder('f3', 'f1'),
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
      f2: folder('f2', 'f3'),
      f3: folder('f3', 'f4'),
      f4: folder('f4', null),
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
      f2: folder('f2', 'f3'),
      f3: folder('f3', 'f2'),
    }
    const result = validateNoCircularParent(
      testId<'sidebarItems'>('f1'),
      testId<'sidebarItems'>('f2'),
      (id) => tree[id],
    )
    expect(result).toEqual({ valid: true })
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

    const result = await dmAuth.mutation(api.folders.mutations.createFolder, {
      campaignId: ctx.campaignId,
      name: 'test',
      parentTarget: { kind: 'direct', parentId: null },
    })

    expect(result.slug).toBe('test-2')
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
      location: 'trash',
    })

    const result = await dmAuth.mutation(api.folders.mutations.createFolder, {
      campaignId: ctx.campaignId,
      name: 'deleted-item',
      parentTarget: { kind: 'direct', parentId: null },
    })

    expect(result.slug).toBe('deleted-item-2')
  })

  it('rejects invalid slugs at the query boundary', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expect(
      dmAuth.query(api.sidebarItems.queries.getSidebarItemBySlug, {
        campaignId: ctx.campaignId,
        slug: 'bad slug',
      }),
    ).rejects.toThrow('Slug can only contain lowercase letters, numbers, and single hyphens')
  })

  it('rejects create requests whose names cannot produce a valid slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expect(
      dmAuth.mutation(api.notes.mutations.createNote, {
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

    const first = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: firstName,
      parentTarget: { kind: 'direct', parentId: null },
      content: [],
    })

    const second = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: secondName,
      parentTarget: { kind: 'direct', parentId: null },
      content: [],
    })

    expect(validateItemSlug(first.slug)).toEqual({ valid: true })
    expect(validateItemSlug(second.slug)).toEqual({ valid: true })
    expect(first.slug.length).toBeLessThanOrEqual(255)
    expect(second.slug.length).toBeLessThanOrEqual(255)
  })

  it('rejects invalid note colors at the mutation boundary', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expect(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'bad-color-note',
        parentTarget: { kind: 'direct', parentId: null },
        color: 'red',
        content: [],
      }),
    ).rejects.toThrow('Color must be a 6- or 8-digit hex value')
  })

  it('rejects invalid folder icons at the mutation boundary', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const folder = await dmAuth.mutation(api.folders.mutations.createFolder, {
      campaignId: ctx.campaignId,
      name: 'folder-to-update',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expect(
      dmAuth.mutation(api.folders.mutations.updateFolder, {
        campaignId: ctx.campaignId,
        folderId: folder.folderId,
        iconName: 'InvalidIcon' as never,
      }),
    ).rejects.toThrow('Icon is not supported')
  })

  it('stores file colors in lowercase canonical form', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.files.mutations.createFile, {
      campaignId: ctx.campaignId,
      name: 'file-with-color',
      parentTarget: { kind: 'direct', parentId: null },
      iconName: 'Shield',
      color: '#ABCDEF',
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

    const map = await dmAuth.mutation(api.gameMaps.mutations.createMap, {
      campaignId: ctx.campaignId,
      name: 'map-color',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.gameMaps.mutations.updateMap, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
      iconName: 'Grid2x2Plus',
      color: '#ABCDEF80',
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

    const canvas = await dmAuth.mutation(api.canvases.mutations.createCanvas, {
      campaignId: ctx.campaignId,
      name: 'canvas-to-update',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expect(
      dmAuth.mutation(api.canvases.mutations.updateCanvas, {
        campaignId: ctx.campaignId,
        canvasId: canvas.canvasId,
        color: '#12',
      }),
    ).rejects.toThrow('Color must be a 6- or 8-digit hex value')
  })
})
