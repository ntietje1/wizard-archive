import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  createFolderViaFilesystem,
  createNoteViaFilesystem,
} from '../../_test/filesystemSetup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createNote, createSidebarShare } from '../../_test/factories.helper'
import { expectPermissionDenied, expectValidationFailed } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('create item with parentTarget paths', () => {
  const t = createTestContext()

  it('creates missing parent folders transactionally for notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Leaf Note',
      parentTarget: {
        kind: 'path',
        baseParentId: null,
        pathSegments: ['Arc One', 'Arc Two'],
      },
    })

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    const arcOne = rootItems.find((item) => item.name === 'Arc One')

    expect(arcOne?.type).toBe('folder')

    const arcOneChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcOne!.id,
    })
    const arcTwo = arcOneChildren.find((item) => item.name === 'Arc Two')

    expect(arcTwo?.type).toBe('folder')

    const arcTwoChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcTwo!.id,
    })
    const createdNote = arcTwoChildren.find((item) => item.id === result.noteId)

    expect(createdNote?.name).toBe('Leaf Note')
  })

  it('rejects player-created folder resources and missing path folders', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { folderId: sharedFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Shared Folder',
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: sharedFolderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    await expectPermissionDenied(
      executeTestFileSystemCommand(playerAuth, {
        campaignId: ctx.campaignId,
        command: {
          type: 'create',
          itemType: 'folder',
          name: 'Restricted Folder',
          parentTarget: { kind: 'direct', parentId: sharedFolderId },
        },
      }),
    )
    await expectPermissionDenied(
      createNoteViaFilesystem(playerAuth, {
        campaignId: ctx.campaignId,
        name: 'Restricted Note',
        parentTarget: {
          kind: 'path',
          baseParentId: sharedFolderId,
          pathSegments: ['Restricted Folder'],
        },
      }),
    )
  })

  it('rolls back created parent folders when note creation fails after path resolution', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      executeTestFileSystemCommand(dmAuth, {
        campaignId: ctx.campaignId,
        command: {
          type: 'create',
          itemType: 'note',
          name: '   ' as never,
          parentTarget: {
            kind: 'path',
            baseParentId: null,
            pathSegments: ['Arc One', 'Arc Two'],
          },
        },
      }),
    )

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    const arcOne = rootItems.find((item) => item.name === 'Arc One')

    expect(arcOne).toBeUndefined()
  })

  it('creates missing path folders under a provided parentTarget base for notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: baseFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Base Folder',
    })

    const result = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Leaf Note',
      parentTarget: {
        kind: 'path',
        baseParentId: baseFolderId,
        pathSegments: ['Arc One', 'Arc Two'],
      },
    })

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    expect(rootItems.some((item) => item.name === 'Arc One')).toBe(false)

    const baseChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: baseFolderId,
    })
    const arcOne = baseChildren.find((item) => item.name === 'Arc One')

    expect(baseChildren.filter((item) => item.name === 'Arc One')).toHaveLength(1)
    expect(arcOne?.type).toBe('folder')
    expect(baseChildren.some((item) => item.id === result.noteId)).toBe(false)

    const arcOneChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcOne!.id,
    })
    const arcTwo = arcOneChildren.find((item) => item.name === 'Arc Two')

    expect(arcOneChildren.filter((item) => item.name === 'Arc Two')).toHaveLength(1)
    expect(arcTwo?.type).toBe('folder')

    const arcTwoChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcTwo!.id,
    })
    const createdNote = arcTwoChildren.find((item) => item.id === result.noteId)

    expect(createdNote?.name).toBe('Leaf Note')
  })

  it('reuses existing path folders for folder creation', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: arcOneId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc One',
    })
    await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc Two',
      parentId: arcOneId,
    })

    await createFolderViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Leaf Folder',
      parentTarget: {
        kind: 'path',
        baseParentId: null,
        pathSegments: ['Arc One', 'Arc Two'],
      },
    })

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    expect(rootItems.filter((item) => item.name === 'Arc One')).toHaveLength(1)

    const arcOneChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcOneId,
    })
    const arcTwo = arcOneChildren.find((item) => item.name === 'Arc Two')

    expect(arcOneChildren.filter((item) => item.name === 'Arc Two')).toHaveLength(1)

    const arcTwoChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcTwo!.id,
    })
    expect(arcTwoChildren.some((item) => item.name === 'Leaf Folder')).toBe(true)
  })

  it('reuses existing path folders under a provided parentTarget base for folder creation', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: baseFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Base Folder',
    })
    const { folderId: arcOneId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc One',
      parentId: baseFolderId,
    })
    await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc Two',
      parentId: arcOneId,
    })

    await createFolderViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Leaf Folder',
      parentTarget: {
        kind: 'path',
        baseParentId: baseFolderId,
        pathSegments: ['Arc One', 'Arc Two'],
      },
    })

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    expect(rootItems.some((item) => item.name === 'Arc One')).toBe(false)

    const baseChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: baseFolderId,
    })
    const arcOne = baseChildren.find((item) => item.name === 'Arc One')

    expect(baseChildren.filter((item) => item.name === 'Arc One')).toHaveLength(1)
    expect(arcOne?.id).toBe(arcOneId)

    const arcOneChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcOneId,
    })
    const arcTwo = arcOneChildren.find((item) => item.name === 'Arc Two')

    expect(arcOneChildren.filter((item) => item.name === 'Arc Two')).toHaveLength(1)
    expect(arcTwo?.type).toBe('folder')

    const arcTwoChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcTwo!.id,
    })
    expect(arcTwoChildren.some((item) => item.name === 'Leaf Folder')).toBe(true)
  })

  it('rejects path segments that collide with non-folder items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc One',
    })

    await expectValidationFailed(
      createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Leaf Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Arc One', 'Arc Two'],
        },
      }),
    )
  })

  it('rejects path segment collisions under a provided parentTarget base', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: baseFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Base Folder',
    })

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc One',
      parentId: baseFolderId,
    })

    await expectValidationFailed(
      createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Leaf Note',
        parentTarget: {
          kind: 'path',
          baseParentId: baseFolderId,
          pathSegments: ['Arc One', 'Arc Two'],
        },
      }),
    )

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    expect(rootItems.some((item) => item.name === 'Arc One')).toBe(false)

    const baseChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: baseFolderId,
    })
    expect(baseChildren.filter((item) => item.name === 'Arc One')).toHaveLength(1)
    expect(baseChildren.find((item) => item.name === 'Arc One')?.type).toBe('note')
  })

  it('supports dot traversal in explicit parentTarget paths', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: baseFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Base Folder',
    })

    const result = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Leaf Note',
      parentTarget: {
        kind: 'path',
        baseParentId: baseFolderId,
        pathSegments: ['.', 'Nested'],
      },
    })

    const baseChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: baseFolderId,
    })
    const nestedFolder = baseChildren.find((item) => item.name === 'Nested')

    expect(nestedFolder?.type).toBe('folder')

    const nestedChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: nestedFolder!.id,
    })
    expect(nestedChildren.some((item) => item.id === result.noteId)).toBe(true)
  })

  it('supports dotdot traversal in explicit parentTarget paths', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: worldId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'World',
    })
    const { folderId: regionId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Region',
      parentId: worldId,
    })

    const result = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Leaf Note',
      parentTarget: {
        kind: 'path',
        baseParentId: regionId,
        pathSegments: ['..', 'Archive'],
      },
    })

    const worldChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: worldId,
    })
    const archiveFolder = worldChildren.find((item) => item.name === 'Archive')

    expect(archiveFolder?.type).toBe('folder')

    const archiveChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: archiveFolder!.id,
    })
    expect(archiveChildren.some((item) => item.id === result.noteId)).toBe(true)
  })

  it('rejects explicit parentTarget paths that traverse above root', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Leaf Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['..', 'Archive'],
        },
      }),
    )
    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    expect(rootItems.some((item) => item.name === 'Archive')).toBe(false)
  })
})
