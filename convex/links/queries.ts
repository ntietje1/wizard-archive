import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { isActiveResource } from '@wizard-archive/editor/resources/resource-contract'
import type { AnyResourceRow } from '@wizard-archive/editor/resources/resource-contract'
import { sidebarItemTypeValidator } from '../sidebarItems/schema/validators'
import { PERMISSION_LEVEL } from '../../shared/permissions/types'
import { getSidebarItem } from '../sidebarItems/functions/getSidebarItem'
import { checkItemAccess } from '../sidebarItems/validation/access'
import type { Doc, Id } from '../_generated/dataModel'
import type { CampaignQueryCtx } from '../functions'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { resourceIdValidator } from '../resources/validators'
import { findSidebarItemRow } from '../sidebarItems/functions/sidebarItemIdentity'
type LinkPanelItem = Pick<AnyResourceRow, 'id' | 'name' | 'slug' | 'type'>

type LinkPanelRow = Pick<Doc<'noteLinks'>, 'blockId' | 'query' | 'displayName' | 'syntax'> & {
  id: Id<'noteLinks'>
  createdAt: number
  item: LinkPanelItem | null
}

const linkPanelItemValidator = v.object({
  id: resourceIdValidator,
  name: v.string(),
  slug: v.string(),
  type: sidebarItemTypeValidator,
})

const linkPanelRowValidator = v.object({
  id: v.id('noteLinks'),
  createdAt: v.number(),
  blockId: v.id('blocks'),
  query: v.string(),
  displayName: v.union(v.string(), v.null()),
  syntax: v.union(v.literal('wiki'), v.literal('md')),
  item: v.union(linkPanelItemValidator, v.null()),
})

async function toLinkPanelItem(
  ctx: CampaignQueryCtx,
  item: AnyResourceRow | null,
): Promise<LinkPanelItem | null> {
  if (!item || !isActiveResource(item)) return null
  const visibleItem = await checkItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!visibleItem) return null
  return {
    id: visibleItem.id,
    name: visibleItem.name,
    slug: visibleItem.slug,
    type: visibleItem.type,
  }
}

async function getLinkPanelItem(
  ctx: CampaignQueryCtx,
  itemId: Id<'sidebarItems'>,
): Promise<LinkPanelItem | null> {
  return toLinkPanelItem(ctx, await getSidebarItem(ctx, itemId))
}

function toLinkPanelRow(link: Doc<'noteLinks'>, item: LinkPanelItem | null): LinkPanelRow {
  return {
    id: link._id,
    createdAt: link._creationTime,
    blockId: link.blockId,
    query: link.query,
    displayName: link.displayName,
    syntax: link.syntax,
    item,
  }
}

async function getBacklinkPanelRowsFn(
  ctx: CampaignQueryCtx,
  { itemId }: { itemId: ResourceId },
): Promise<Array<LinkPanelRow>> {
  const targetRow = await findSidebarItemRow(ctx, itemId)
  if (!targetRow) return []
  const target = await getLinkPanelItem(ctx, targetRow._id)
  if (!target) return []

  const links = await ctx.db
    .query('noteLinks')
    .withIndex('by_campaign_target', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('targetItemId', targetRow._id),
    )
    .collect()
  const rows = await Promise.all(
    links.map(async (link) => {
      const source = await getLinkPanelItem(ctx, link.sourceNoteId)
      return source ? toLinkPanelRow(link, source) : null
    }),
  )

  return rows.filter((row): row is LinkPanelRow => row !== null)
}

async function getOutgoingLinkPanelRowsFn(
  ctx: CampaignQueryCtx,
  { noteId }: { noteId: ResourceId },
): Promise<Array<LinkPanelRow>> {
  const sourceRow = await findSidebarItemRow(ctx, noteId)
  if (!sourceRow) return []
  const source = await getLinkPanelItem(ctx, sourceRow._id)
  if (!source) return []

  const links = await ctx.db
    .query('noteLinks')
    .withIndex('by_campaign_source', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('sourceNoteId', sourceRow._id),
    )
    .collect()

  return await Promise.all(
    links.map(async (link) => {
      const target = link.targetItemId ? await getLinkPanelItem(ctx, link.targetItemId) : null
      return toLinkPanelRow(link, target)
    }),
  )
}

export const getBacklinkPanelRows = campaignQuery({
  args: {
    itemId: resourceIdValidator,
  },
  returns: v.array(linkPanelRowValidator),
  handler: async (ctx, { itemId }) => {
    return await getBacklinkPanelRowsFn(ctx, { itemId })
  },
})

export const getOutgoingLinkPanelRows = campaignQuery({
  args: {
    noteId: resourceIdValidator,
  },
  returns: v.array(linkPanelRowValidator),
  handler: async (ctx, { noteId }) => {
    return await getOutgoingLinkPanelRowsFn(ctx, { noteId })
  },
})
