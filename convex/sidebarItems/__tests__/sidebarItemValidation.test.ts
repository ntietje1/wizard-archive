import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vite-plus/test'
import { createTestContext } from '../../_test/setup.helper'
import {
  createFolderViaFilesystem,
  createGameMapViaFilesystem,
  createCanvasViaFilesystem,
} from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { testResourceId } from '../../../shared/test/resource-id'
import {
  canonicalizeResourceItemTitle,
  validateResourceTitle,
  validateNoCircularParentAsync,
} from '@wizard-archive/editor/resources/items'
import {
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import { requireCreateParentTarget } from '../validation/parent'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'

describe('validateResourceTitle', () => {
  it('canonicalizes blank titles to Untitled', () => {
    expect(validateResourceTitle('')).toEqual({ valid: true })
    expect(canonicalizeResourceItemTitle('   ')).toBe('Untitled')
  })

  it('accepts exactly 255 characters', () => {
    const name = 'a'.repeat(255)
    expect(validateResourceTitle(name)).toEqual({ valid: true })
  })

  it('rejects 256 characters', () => {
    const name = 'a'.repeat(256)
    const result = validateResourceTitle(name)
    expect(result.valid).toBe(false)
  })

  it('accepts natural Unicode and filesystem-reserved characters', () => {
    expect(validateResourceTitle('./a\\b:*?"<>[]#|. 🎉')).toEqual({ valid: true })
  })

  it('normalizes Unicode and control runs', () => {
    expect(canonicalizeResourceItemTitle('  e\u0301\r\n\tTitle  ')).toBe('é Title')
  })

  it('counts Unicode scalars and rejects malformed UTF-16', () => {
    expect(validateResourceTitle('🎉'.repeat(255))).toEqual({ valid: true })
    expect(validateResourceTitle('🎉'.repeat(256)).valid).toBe(false)
    expect(validateResourceTitle('\ud800').valid).toBe(false)
  })
})

describe('sidebar item lifecycle schema invariants', () => {
  const t = createTestContext()

  it('rejects lifecycle patches that omit required trash metadata', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expect(
      t.run(async (dbCtx) =>
        dbCtx.db.patch('sidebarItems', noteRowId, { status: RESOURCE_STATUS.trashed } as never),
      ),
    ).rejects.toThrow('Validator error')

    await t.run(async (dbCtx) => {
      await expect(dbCtx.db.get('sidebarItems', noteRowId)).resolves.toMatchObject({
        status: RESOURCE_STATUS.active,
        deletionTime: null,
        deletedBy: null,
      })
    })
  })
})

describe('validateNoCircularParent', () => {
  const folder = (parentId: string | null) => ({
    parentId: parentId ? testResourceId(parentId) : null,
  })

  it('returns valid for null parent', async () => {
    const result = await validateNoCircularParentAsync(testResourceId('f1'), null, () => undefined)
    expect(result).toEqual({ valid: true })
  })

  it('rejects item as its own parent', async () => {
    const result = await validateNoCircularParentAsync(
      testResourceId('f1'),
      testResourceId('f1'),
      () => undefined,
    )
    expect(result.valid).toBe(false)
  })

  it('detects ancestor cycle', async () => {
    const tree: Record<string, { parentId: ResourceId | null }> = {
      [testResourceId('f2')]: folder('f3'),
      [testResourceId('f3')]: folder('f1'),
    }
    const result = await validateNoCircularParentAsync(
      testResourceId('f1'),
      testResourceId('f2'),
      (id) => tree[id],
    )
    expect(result.valid).toBe(false)
  })

  it('allows deep chain with no cycle', async () => {
    const tree: Record<string, { parentId: ResourceId | null }> = {
      [testResourceId('f2')]: folder('f3'),
      [testResourceId('f3')]: folder('f4'),
      [testResourceId('f4')]: folder(null),
    }
    const result = await validateNoCircularParentAsync(
      testResourceId('f1'),
      testResourceId('f2'),
      (id) => tree[id],
    )
    expect(result).toEqual({ valid: true })
  })

  it('rejects circular source data through the seen set', async () => {
    const tree: Record<string, { parentId: ResourceId | null }> = {
      [testResourceId('f2')]: folder('f3'),
      [testResourceId('f3')]: folder('f2'),
    }
    const result = await validateNoCircularParentAsync(
      testResourceId('f1'),
      testResourceId('f2'),
      (id) => tree[id],
    )
    expect(result).toEqual({
      valid: false,
      error: 'This move would create a circular reference',
    })
  })

  it('supports async parent lookups with the same behavior', async () => {
    const tree: Record<string, { parentId: ResourceId | null }> = {
      [testResourceId('f2')]: folder('f3'),
      [testResourceId('f3')]: folder('f1'),
    }
    const result = await validateNoCircularParentAsync(
      testResourceId('f1'),
      testResourceId('f2'),
      (id) => Promise.resolve(tree[id]),
    )
    expect(result.valid).toBe(false)
  })
})

describe('requireCreateParentTarget', () => {
  it('preserves direct parent targets for command execution', () => {
    const parentId = testResourceId('direct-parent')

    expect(requireCreateParentTarget({ kind: 'direct', parentId })).toEqual({
      kind: 'direct',
      parentId,
    })
  })

  it('normalizes path segments to backend-safe parent path tokens', () => {
    expect(
      requireCreateParentTarget({
        kind: 'path',
        baseParentId: null,
        pathSegments: ['.', '  Lore  ', '..'],
      }),
    ).toEqual({
      kind: 'path',
      baseParentId: null,
      pathSegments: ['.', 'Lore', '..'],
    })
  })
})

describe('sidebar item mutation validation', () => {
  const t = createTestContext()

  it('rejects invalid note colors at the mutation boundary', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expect(
      executeTestFileSystemCommand(dmAuth, {
        campaignId: ctx.campaignDomainId,
        command: {
          type: 'create',
          itemType: RESOURCE_TYPES.notes,
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
      campaignId: ctx.campaignDomainId,
      name: 'folder-to-update',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expect(
      executeTestFileSystemCommand(dmAuth, {
        campaignId: ctx.campaignDomainId,
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

    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: {
        type: 'create',
        itemType: RESOURCE_TYPES.files,
        name: 'file-with-color',
        parentTarget: { kind: 'direct', parentId: null },
        iconName: 'Shield',
        color: '#ABCDEF',
      },
    })
    const created = receipt.events.find((event) => event.type === 'created')
    if (!created || created.type !== 'created') {
      throw new Error('Expected file create command to create a sidebar item')
    }

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignDomainId,
      id: created.itemId,
    })

    expect(item?.iconName).toBe('Shield')
    expect(item?.color).toBe('#abcdef')
  })

  it('stores updated map colors in lowercase canonical form', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const map = await createGameMapViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'map-color',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: {
        type: 'rename',
        itemId: map.mapId,
        iconName: 'Grid2x2Plus',
        color: '#ABCDEF80',
      },
    })

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignDomainId,
      id: map.mapId,
    })

    expect(item?.iconName).toBe('Grid2x2Plus')
    expect(item?.color).toBe('#abcdef80')
  })

  it('rejects invalid canvas colors at the mutation boundary', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const canvas = await createCanvasViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'canvas-to-update',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expect(
      executeTestFileSystemCommand(dmAuth, {
        campaignId: ctx.campaignDomainId,
        command: {
          type: 'rename',
          itemId: canvas.canvasId,
          color: '#12' as never,
        },
      }),
    ).rejects.toThrow('Color must be a 6- or 8-digit hex value')
  })
})

describe('folder share inheritance defaults', () => {
  const t = createTestContext()

  async function getFolderInheritShares(
    client: ReturnType<typeof asDm>,
    campaignId: CampaignId,
    folderId: ResourceId,
  ) {
    const item = await client.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId,
      id: folderId,
    })
    expect(item.type).toBe(RESOURCE_TYPES.folders)
    if (item.type !== RESOURCE_TYPES.folders) throw new Error('Expected folder')
    return item.inheritShares
  }

  it('creates folders with inheritance disabled by default', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const folder = await createFolderViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'default-off',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expect(
      getFolderInheritShares(dmAuth, ctx.campaignDomainId, folder.folderId),
    ).resolves.toBe(false)
  })

  it('uses the campaign folder inheritance default only for future folders', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const before = await createFolderViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'before-setting-change',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.campaigns.mutations.updateCampaign, {
      campaignId: ctx.campaignDomainId,
      defaultFolderInheritShares: true,
    })

    const afterEnabled = await createFolderViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'after-setting-enabled',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.campaigns.mutations.updateCampaign, {
      campaignId: ctx.campaignDomainId,
      defaultFolderInheritShares: false,
    })

    const afterDisabled = await createFolderViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'after-setting-disabled',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expect(
      getFolderInheritShares(dmAuth, ctx.campaignDomainId, before.folderId),
    ).resolves.toBe(false)
    await expect(
      getFolderInheritShares(dmAuth, ctx.campaignDomainId, afterEnabled.folderId),
    ).resolves.toBe(true)
    await expect(
      getFolderInheritShares(dmAuth, ctx.campaignDomainId, afterDisabled.folderId),
    ).resolves.toBe(false)
  })
})
