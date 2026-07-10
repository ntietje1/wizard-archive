import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { createTestContext } from '../../_test/setup.helper'
import { createNoteViaFilesystem } from '../../_test/filesystemSetup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createSidebarShare } from '../../_test/factories.helper'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'

describe('link panel rows', () => {
  const t = createTestContext()

  it('resolves outgoing rows to target sidebar item summaries and keeps unresolved links', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Target Note',
    })
    const { noteId: sourceId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      content: [
        {
          id: 'block-a',
          type: 'paragraph',
          props: {},
          content: [
            {
              type: 'text',
              text: 'See [[Target Note|Target Alias]] and [[Missing Note]]',
              styles: {},
            },
          ],
          children: [],
        },
      ],
    })

    const rows = await dmAuth.query(api.links.queries.getOutgoingLinkPanelRows, {
      campaignId: ctx.campaignId,
      noteId: sourceId,
    })

    expect(rows).toHaveLength(2)
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          query: 'Target Note',
          displayName: 'Target Alias',
          item: expect.objectContaining({
            name: 'Target Note',
            slug: 'target-note',
            type: 'note',
          }),
        }),
        expect.objectContaining({
          query: 'Missing Note',
          displayName: null,
          item: null,
        }),
      ]),
    )
  })

  it('resolves backlinks to source note summaries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: targetId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Target Note',
    })
    const { noteId: sourceId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Source Note',
      content: [
        {
          id: 'block-a',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'See [[Target Note]]', styles: {} }],
          children: [],
        },
      ],
    })

    const rows = await dmAuth.query(api.links.queries.getBacklinkPanelRows, {
      campaignId: ctx.campaignId,
      itemId: targetId,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      query: 'Target Note',
      item: {
        id: sourceId,
        name: 'Source Note',
        slug: 'source-note',
        type: 'note',
      },
    })
  })

  it('does not expose inaccessible outgoing link targets', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Hidden Target',
    })
    const { noteId: sourceId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Shared Source',
      content: [
        {
          id: 'block-a',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'See [[Hidden Target]]', styles: {} }],
          children: [],
        },
      ],
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: sourceId,
      sidebarItemType: RESOURCE_TYPES.notes,
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const rows = await playerAuth.query(api.links.queries.getOutgoingLinkPanelRows, {
      campaignId: ctx.campaignId,
      noteId: sourceId,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      query: 'Hidden Target',
      item: null,
    })
  })

  it('omits backlinks from inaccessible source notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId: targetId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Shared Target',
    })
    await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Hidden Source',
      content: [
        {
          id: 'block-a',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'See [[Shared Target]]', styles: {} }],
          children: [],
        },
      ],
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: targetId,
      sidebarItemType: RESOURCE_TYPES.notes,
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const rows = await playerAuth.query(api.links.queries.getBacklinkPanelRows, {
      campaignId: ctx.campaignId,
      itemId: targetId,
    })

    expect(rows).toEqual([])
  })
})
