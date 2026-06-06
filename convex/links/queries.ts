import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { isActiveSidebarItem } from '../../shared/sidebar-items/types'
import { sidebarItemTypeValidator } from '../sidebarItems/schema/validators'
import type { Doc, Id } from '../_generated/dataModel'
import type { CampaignQueryCtx } from '../functions'
import type { AnySidebarItemRow } from '../../shared/sidebar-items/model-types'

type LinkPanelItem = Pick<AnySidebarItemRow, '_id' | 'name' | 'slug' | 'type'>

type LinkPanelRow = Pick<
  Doc<'noteLinks'>,
  '_id' | '_creationTime' | 'blockId' | 'query' | 'displayName' | 'syntax'
> & {
  item: LinkPanelItem | null
}

const linkPanelItemValidator = v.object({
  _id: v.id('sidebarItems'),
  name: v.string(),
  slug: v.string(),
  type: sidebarItemTypeValidator,
})

const linkPanelRowValidator = v.object({
  _id: v.id('noteLinks'),
  _creationTime: v.number(),
  blockId: v.id('blocks'),
  query: v.string(),
  displayName: v.union(v.string(), v.null()),
  syntax: v.union(v.literal('wiki'), v.literal('md')),
  item: v.union(linkPanelItemValidator, v.null()),
})

function toLinkPanelItem(item: Doc<'sidebarItems'> | null, campaignId: Id<'campaigns'>) {
  if (!item || item.campaignId !== campaignId || !isActiveSidebarItem(item)) return null
  return {
    _id: item._id,
    name: item.name,
    slug: item.slug,
    type: item.type,
  }
}

async function getLinkPanelItem(
  ctx: CampaignQueryCtx,
  itemId: Id<'sidebarItems'>,
): Promise<LinkPanelItem | null> {
  return toLinkPanelItem(await ctx.db.get('sidebarItems', itemId), ctx.campaign._id)
}

function toLinkPanelRow(link: Doc<'noteLinks'>, item: LinkPanelItem | null): LinkPanelRow {
  return {
    _id: link._id,
    _creationTime: link._creationTime,
    blockId: link.blockId,
    query: link.query,
    displayName: link.displayName,
    syntax: link.syntax,
    item,
  }
}

async function getBacklinkPanelRowsFn(
  ctx: CampaignQueryCtx,
  { itemId }: { itemId: Id<'sidebarItems'> },
): Promise<Array<LinkPanelRow>> {
  const links = await ctx.db
    .query('noteLinks')
    .withIndex('by_campaign_target', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('targetItemId', itemId),
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
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<Array<LinkPanelRow>> {
  const links = await ctx.db
    .query('noteLinks')
    .withIndex('by_campaign_source', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('sourceNoteId', noteId),
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
    itemId: v.id('sidebarItems'),
  },
  returns: v.array(linkPanelRowValidator),
  handler: async (ctx, { itemId }) => {
    return await getBacklinkPanelRowsFn(ctx, { itemId })
  },
})

export const getOutgoingLinkPanelRows = campaignQuery({
  args: {
    noteId: v.id('sidebarItems'),
  },
  returns: v.array(linkPanelRowValidator),
  handler: async (ctx, { noteId }) => {
    return await getOutgoingLinkPanelRowsFn(ctx, { noteId })
  },
})
