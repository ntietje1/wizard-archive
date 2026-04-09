import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createNote } from '../../_test/factories.helper'
import { testId } from '../../_test/test-id.helper'
import { checkNameConflict, validateItemName, validateNoCircularParent } from '../sharedValidation'
import { api } from '../../_generated/api'
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
})

describe('checkNameConflict', () => {
  const siblings = [
    { _id: testId<'notes'>('id1'), name: 'Alpha' },
    { _id: testId<'notes'>('id2'), name: 'Beta' },
  ]

  it('returns valid when no conflict', () => {
    expect(checkNameConflict('Gamma', siblings)).toEqual({ valid: true })
  })

  it('detects case-insensitive match', () => {
    const result = checkNameConflict('alpha', siblings)
    expect(result.valid).toBe(false)
  })

  it('excludes self from conflict check', () => {
    const result = checkNameConflict('Alpha', siblings, testId<'notes'>('id1'))
    expect(result).toEqual({ valid: true })
  })
})

describe('validateNoCircularParent', () => {
  const folder = (_id: string, parentId: string | null) => ({
    parentId: parentId ? testId<'folders'>(parentId) : null,
  })

  it('returns valid for null parent', () => {
    const result = validateNoCircularParent(testId<'folders'>('f1'), null, () => undefined)
    expect(result).toEqual({ valid: true })
  })

  it('rejects item as its own parent', () => {
    const result = validateNoCircularParent(
      testId<'folders'>('f1'),
      testId<'folders'>('f1'),
      () => undefined,
    )
    expect(result.valid).toBe(false)
  })

  it('detects ancestor cycle', () => {
    const tree: Record<string, { parentId: Id<'folders'> | null }> = {
      f2: folder('f2', 'f3'),
      f3: folder('f3', 'f1'),
    }
    const result = validateNoCircularParent(
      testId<'folders'>('f1'),
      testId<'folders'>('f2'),
      (id) => tree[id],
    )
    expect(result.valid).toBe(false)
  })

  it('allows deep chain with no cycle', () => {
    const tree: Record<string, { parentId: Id<'folders'> | null }> = {
      f2: folder('f2', 'f3'),
      f3: folder('f3', 'f4'),
      f4: folder('f4', null),
    }
    const result = validateNoCircularParent(
      testId<'folders'>('f1'),
      testId<'folders'>('f2'),
      (id) => tree[id],
    )
    expect(result).toEqual({ valid: true })
  })

  it('breaks on circular data via seen set', () => {
    const tree: Record<string, { parentId: Id<'folders'> | null }> = {
      f2: folder('f2', 'f3'),
      f3: folder('f3', 'f2'),
    }
    const result = validateNoCircularParent(
      testId<'folders'>('f1'),
      testId<'folders'>('f2'),
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
      parentId: null,
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
      parentId: null,
    })

    expect(result.slug).toBe('deleted-item-2')
  })
})
