import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createSidebarShare } from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { getClientErrorMessage } from '../../errors'
import type { CustomBlock } from '../editorSpecs'

describe('createNote', () => {
  const t = createTestContext()

  it('creates a note with a unique slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'My Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    expect(result.noteId).toBeDefined()
    expect(result.slug).toContain('my-note')

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', result.noteId)
      expect(note).not.toBeNull()
      expect(note!.name).toBe('My Note')
      expect(note!.parentId).toBeNull()
      expect(note!.campaignId).toBe(ctx.campaignId)
      expect(note!.type).toBe('note')
    })
  })

  it('creates noteLinks immediately for initial content links', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const initialContent: Array<CustomBlock> = [
      {
        id: 'block-a',
        type: 'paragraph',
        props: {},
        content: [
          { type: 'text', text: 'See [[Target Note]]', styles: {} },
        ] as CustomBlock['content'],
        children: [],
      },
      {
        id: 'block-b',
        type: 'paragraph',
        props: {},
        content: [
          { type: 'text', text: 'And [Alias](Target Note)', styles: {} },
        ] as CustomBlock['content'],
        children: [],
      },
    ]

    const { noteId: targetId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Target Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const { noteId: sourceId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      parentTarget: { kind: 'direct', parentId: null },
      content: initialContent,
    })

    await t.run(async (dbCtx) => {
      const links = await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()

      expect(links).toHaveLength(2)
      expect(links.every((link) => link.targetItemId === targetId)).toBe(true)
      expect(links.map((link) => link.query).sort()).toEqual(['Target Note', 'Target Note'])
    })
  })

  it('creates a note inside a folder', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Child Note',
      parentTarget: { kind: 'direct', parentId: folderId },
    })

    expect(result.noteId).toBeDefined()

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', result.noteId)
      expect(note!.parentId).toBe(folderId)
    })
  })

  it('rejects non-folder parents', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: parentId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Parent Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const error = await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Child Note',
        parentTarget: { kind: 'direct', parentId },
      }),
    )

    expect(getClientErrorMessage(error)).toBe('Parent must be a folder')
  })

  it('sets optional iconName and color', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Styled Note',
      parentTarget: { kind: 'direct', parentId: null },
      iconName: 'Notebook',
      color: '#ff0000',
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', result.noteId)
      expect(note!.iconName).toBe('Notebook')
      expect(note!.color).toBe('#ff0000')
    })
  })

  it('player cannot create at root level', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Player Note',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })

  it('player with FULL_ACCESS on parent can create inside', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    const result = await playerAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Player Child Note',
      parentTarget: { kind: 'direct', parentId: folderId },
    })
    expect(result.noteId).toBeDefined()
  })

  it('player with edit permission on parent cannot create inside', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Child Note',
        parentTarget: { kind: 'direct', parentId: folderId },
      }),
    )
  })

  it('validates empty name', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: '',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })

  it('validates whitespace-only name', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: '   ',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })

  it('validates name uniqueness under same parent', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Duplicate',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Duplicate',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })

  it('validates name uniqueness case-insensitively', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Duplicate',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'duplicate',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })

  it('allows same name under different parents', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Same Name',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Same Name',
      parentTarget: { kind: 'direct', parentId: folderId },
    })
    expect(result.noteId).toBeDefined()
  })

  it('rejects names with leading or trailing whitespace', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: '  Padded Name  ',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })

  it('rejects names with leading whitespace only', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: '  Leading',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })

  it('rejects names with trailing whitespace only', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Trailing  ',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)

    await expectNotAuthenticated(
      t.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Nope',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })
})
