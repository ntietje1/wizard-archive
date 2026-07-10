import { extractLinksFromText, getLinkQuery } from '../../../shared/links/extraction'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { LinkSyntax, ParsedLinkData } from '../../../shared/links/types'
import type { Block } from '../../blocks/types'
import type { AccessibleResourcePathResolver } from '../../sidebarItems/functions/resourcePathResolver'
type CampaignScopedMutationCtx = Pick<MutationCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id'>
}
interface NoteLinkRow {
  sourceNoteId: Id<'sidebarItems'>
  targetItemId: Id<'sidebarItems'> | null
  query: string
  displayName: string | null
  syntax: LinkSyntax
  campaignId: Id<'campaigns'>
  blockId: Id<'blocks'>
}

type NoteLinkPatch = { linkId: Id<'noteLinks'>; updates: Partial<NoteLinkRow> }
type NoteLinkDiff = {
  inserts: Array<NoteLinkRow>
  patches: Array<NoteLinkPatch>
  deletions: Array<Id<'noteLinks'>>
}

export async function syncNoteLinks(
  ctx: CampaignScopedMutationCtx,
  {
    noteId,
    campaignId,
    blocks,
    resourcePathResolver,
  }: {
    noteId: Id<'sidebarItems'>
    campaignId: Id<'campaigns'>
    blocks: Array<Block>
    resourcePathResolver: AccessibleResourcePathResolver
  },
): Promise<void> {
  if (campaignId !== ctx.campaign._id) {
    throw new Error('syncNoteLinks campaignId must match the mutation campaign context')
  }

  const existingLinks = await ctx.db
    .query('noteLinks')
    .withIndex('by_campaign_source', (q) =>
      q.eq('campaignId', campaignId).eq('sourceNoteId', noteId),
    )
    .collect()

  const desiredRowsByKey = await buildDesiredLinkRows({
    noteId,
    campaignId,
    blocks,
    resourcePathResolver,
  })
  const existingLinksByKey = groupExistingLinksByKey(existingLinks)
  const { inserts, patches, deletions } = diffNoteLinks(desiredRowsByKey, existingLinksByKey)

  await Promise.all([
    ...deletions.map((linkId) => ctx.db.delete('noteLinks', linkId)),
    ...patches.map(({ linkId, updates }) => ctx.db.patch('noteLinks', linkId, updates)),
    ...inserts.map((row) => ctx.db.insert('noteLinks', row)),
  ])
}

async function buildDesiredLinkRows({
  noteId,
  campaignId,
  blocks,
  resourcePathResolver,
}: {
  noteId: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  blocks: Array<Block>
  resourcePathResolver: AccessibleResourcePathResolver
}) {
  const sourceNote = await resourcePathResolver.getAccessibleItem(noteId)
  const linkEntries = blocks.flatMap((block) =>
    extractLinksFromText(block.plainText).flatMap((link) =>
      link.isExternal ? [] : [{ blockId: block._id, link }],
    ),
  )
  const rows = await Promise.all(
    linkEntries.map(({ blockId, link }) =>
      buildNoteLinkRow({
        link,
        blockId,
        noteId,
        campaignId,
        resourcePathResolver,
        sourceParentId: sourceNote?.parentId,
      }),
    ),
  )
  const rowsByKey = new Map<string, NoteLinkRow>()
  for (const row of rows) {
    const key = getLinkDedupKey(row)
    if (!rowsByKey.has(key)) rowsByKey.set(key, row)
  }
  return rowsByKey
}

async function buildNoteLinkRow({
  link,
  blockId,
  noteId,
  campaignId,
  resourcePathResolver,
  sourceParentId,
}: {
  link: ParsedLinkData
  blockId: Id<'blocks'>
  noteId: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  resourcePathResolver: AccessibleResourcePathResolver
  sourceParentId: Id<'sidebarItems'> | null | undefined
}): Promise<NoteLinkRow> {
  const resolved = await resourcePathResolver.resolvePath({
    pathKind: link.pathKind,
    pathSegments: link.itemPath,
    sourceParentId,
  })
  return {
    sourceNoteId: noteId,
    targetItemId: resolved?._id ?? null,
    query: getLinkQuery(link),
    displayName: link.displayName,
    syntax: link.syntax,
    campaignId,
    blockId,
  }
}

function groupExistingLinksByKey(existingLinks: Array<Doc<'noteLinks'>>) {
  const linksByKey = new Map<string, Array<Doc<'noteLinks'>>>()
  for (const link of existingLinks) {
    const key = getLinkDedupKey(link)
    const list = linksByKey.get(key)
    if (list) list.push(link)
    else linksByKey.set(key, [link])
  }
  return linksByKey
}

function diffNoteLinks(
  desiredRowsByKey: Map<string, NoteLinkRow>,
  existingLinksByKey: Map<string, Array<Doc<'noteLinks'>>>,
): NoteLinkDiff {
  const diff: NoteLinkDiff = { inserts: [], patches: [], deletions: [] }
  for (const [key, desired] of desiredRowsByKey) {
    diffDesiredLink(key, desired, existingLinksByKey, diff)
  }
  for (const [key, matches] of existingLinksByKey) {
    if (desiredRowsByKey.has(key)) continue
    diff.deletions.push(...matches.map((link) => link._id))
  }
  return diff
}

function diffDesiredLink(
  key: string,
  desired: NoteLinkRow,
  existingLinksByKey: Map<string, Array<Doc<'noteLinks'>>>,
  diff: NoteLinkDiff,
) {
  const matches = existingLinksByKey.get(key) ?? []
  const [kept, ...extras] = matches
  diff.deletions.push(...extras.map((link) => link._id))

  if (!kept) {
    diff.inserts.push(desired)
    return
  }

  const updates = changedLinkFields(kept, desired)
  if (Object.keys(updates).length > 0) {
    diff.patches.push({ linkId: kept._id, updates })
  }
}

function changedLinkFields(current: Doc<'noteLinks'>, desired: NoteLinkRow): Partial<NoteLinkRow> {
  const updates: Partial<NoteLinkRow> = {}
  if (current.query !== desired.query) updates.query = desired.query
  if (current.displayName !== desired.displayName) updates.displayName = desired.displayName
  if (current.syntax !== desired.syntax) updates.syntax = desired.syntax
  return updates
}

function getLinkDedupKey(
  row: Pick<Doc<'noteLinks'>, 'blockId' | 'targetItemId' | 'query'>,
): string {
  return row.targetItemId === null
    ? `unresolved:${row.blockId}:${row.query}`
    : `resolved:${row.blockId}:${row.targetItemId}:${row.query}`
}
