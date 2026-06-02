import {
  MD_LINK_REGEX,
  WIKI_LINK_REGEX,
  parseMdLinkTarget,
  parseWikiLinkText,
} from '../../../shared/links/parsing'
import { resolveParsedItemPath } from '../../../shared/links/resolution'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { LinkSyntax, ParsedLinkData } from '../../../shared/links/types'
import type { Block } from '../../blocks/types'
import type { AnySidebarItemRow } from '../../../shared/sidebar-items/model-types'
import { SIDEBAR_ITEM_STATUS } from '../../../shared/sidebar-items/types'

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
  }: {
    noteId: Id<'sidebarItems'>
    campaignId: Id<'campaigns'>
    blocks: Array<Block>
  },
): Promise<void> {
  if (campaignId !== ctx.campaign._id) {
    throw new Error('syncNoteLinks campaignId must match the mutation campaign context')
  }

  const [sidebarItems, existingLinks] = await Promise.all([
    ctx.db
      .query('sidebarItems')
      .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
        q.eq('campaignId', campaignId).eq('status', SIDEBAR_ITEM_STATUS.active),
      )
      .collect(),
    ctx.db
      .query('noteLinks')
      .withIndex('by_campaign_source', (q) =>
        q.eq('campaignId', campaignId).eq('sourceNoteId', noteId),
      )
      .collect(),
  ])

  const allItems: Array<AnySidebarItemRow> = sidebarItems
  const itemsMap = new Map(allItems.map((item) => [item._id, item]))
  const desiredRowsByKey = buildDesiredLinkRows({
    noteId,
    campaignId,
    blocks,
    allItems,
    itemsMap,
    sourceParentId: itemsMap.get(noteId)?.parentId,
  })
  const existingLinksByKey = groupExistingLinksByKey(existingLinks)
  const { inserts, patches, deletions } = diffNoteLinks(desiredRowsByKey, existingLinksByKey)

  await Promise.all([
    ...deletions.map((linkId) => ctx.db.delete('noteLinks', linkId)),
    ...patches.map(({ linkId, updates }) => ctx.db.patch('noteLinks', linkId, updates)),
    ...inserts.map((row) => ctx.db.insert('noteLinks', row)),
  ])
}

function buildDesiredLinkRows({
  noteId,
  campaignId,
  blocks,
  allItems,
  itemsMap,
  sourceParentId,
}: {
  noteId: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  blocks: Array<Block>
  allItems: Array<AnySidebarItemRow>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItemRow>
  sourceParentId: Id<'sidebarItems'> | null | undefined
}) {
  const rowsByKey = new Map<string, NoteLinkRow>()
  for (const block of blocks) {
    for (const link of extractLinksFromText(block.plainText)) {
      if (link.isExternal) continue
      const row = buildNoteLinkRow({
        link,
        blockId: block._id,
        noteId,
        campaignId,
        allItems,
        itemsMap,
        sourceParentId,
      })
      const key = getLinkDedupKey(row)
      if (!rowsByKey.has(key)) rowsByKey.set(key, row)
    }
  }
  return rowsByKey
}

function buildNoteLinkRow({
  link,
  blockId,
  noteId,
  campaignId,
  allItems,
  itemsMap,
  sourceParentId,
}: {
  link: ParsedLinkData
  blockId: Id<'blocks'>
  noteId: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
  allItems: Array<AnySidebarItemRow>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItemRow>
  sourceParentId: Id<'sidebarItems'> | null | undefined
}): NoteLinkRow {
  const resolved = resolveParsedItemPath(
    link.pathKind,
    link.itemPath,
    allItems,
    itemsMap,
    sourceParentId,
  )
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

function extractLinksFromText(text: string): Array<ParsedLinkData> {
  const matches: Array<{ index: number; link: ParsedLinkData }> = []

  const wikiRegex = new RegExp(WIKI_LINK_REGEX.source, 'g')
  let wikiMatch: RegExpExecArray | null
  while ((wikiMatch = wikiRegex.exec(text)) !== null) {
    const innerText = wikiMatch[1]
    const parsed = parseWikiLinkText(innerText)
    matches.push({
      index: wikiMatch.index,
      link: {
        syntax: 'wiki',
        pathKind: parsed.pathKind,
        itemPath: parsed.itemPath,
        itemName: parsed.itemName,
        headingPath: parsed.headingPath,
        displayName: parsed.displayName,
        rawTarget: innerText,
        isExternal: false,
      },
    })
  }

  const mdRegex = new RegExp(MD_LINK_REGEX.source, 'g')
  let mdMatch: RegExpExecArray | null
  while ((mdMatch = mdRegex.exec(text)) !== null) {
    const displayText = mdMatch[1]
    const target = mdMatch[2]
    const parsed = parseMdLinkTarget(target)
    matches.push({
      index: mdMatch.index,
      link: {
        syntax: 'md',
        pathKind: parsed.pathKind,
        itemPath: parsed.itemPath,
        itemName: parsed.itemName,
        headingPath: parsed.headingPath,
        displayName: displayText,
        rawTarget: target,
        isExternal: parsed.isExternal,
      },
    })
  }

  return matches.sort((a, b) => a.index - b.index).map((match) => match.link)
}

function getLinkDedupKey(
  row: Pick<Doc<'noteLinks'>, 'blockId' | 'targetItemId' | 'query'>,
): string {
  return row.targetItemId === null
    ? `unresolved:${row.blockId}:${row.query}`
    : `resolved:${row.blockId}:${row.targetItemId}:${row.query}`
}

function getLinkQuery(link: ParsedLinkData): string {
  const itemPath = link.itemPath.join('/')
  if (link.headingPath.length === 0) return itemPath
  return `${itemPath}#${link.headingPath.join('#')}`
}
