import {
  MD_LINK_REGEX,
  WIKI_LINK_REGEX,
  parseMdLinkTarget,
  parseWikiLinkText,
} from '../linkParsers'
import { resolveItemByPath } from '../linkResolution'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { ParsedLinkData, LinkSyntax } from '../types'
import type { PersistedBlockRecord } from '../../blocks/types'

interface NoteLinkRow {
  sourceNoteId: Id<'sidebarItems'>
  targetItemId: Id<'sidebarItems'> | null
  query: string
  displayName: string | null
  syntax: LinkSyntax
  campaignId: Id<'campaigns'>
  blockId: Id<'blocks'>
}

export async function syncNoteLinks(
  ctx: CampaignMutationCtx,
  {
    noteId,
    campaignId,
    blocks,
  }: {
    noteId: Id<'sidebarItems'>
    campaignId: Id<'campaigns'>
    blocks: Array<PersistedBlockRecord>
  },
): Promise<void> {
  const [allItems, existingLinks] = await Promise.all([
    ctx.db
      .query('sidebarItems')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId).eq('deletionTime', null))
      .collect(),
    ctx.db
      .query('noteLinks')
      .withIndex('by_campaign_source', (q) =>
        q.eq('campaignId', campaignId).eq('sourceNoteId', noteId),
      )
      .collect(),
  ])

  const itemsMap = new Map(allItems.map((item) => [item._id, item]))
  const desiredRowsByKey = new Map<string, NoteLinkRow>()

  for (const block of blocks) {
    const parsedLinks = extractLinksFromText(block.plainText)
    for (const link of parsedLinks) {
      if (link.isExternal) continue

      const resolved = resolveItemByPath(link.itemPath, allItems, itemsMap)
      const row: NoteLinkRow = {
        sourceNoteId: noteId,
        targetItemId: resolved?._id ?? null,
        query: getLinkQuery(link),
        displayName: link.displayName,
        syntax: link.syntax,
        campaignId,
        blockId: block._id,
      }
      const key = getLinkDedupKey(row)
      if (!desiredRowsByKey.has(key)) {
        desiredRowsByKey.set(key, row)
      }
    }
  }

  const existingLinksByKey = new Map<string, Array<Doc<'noteLinks'>>>()
  for (const link of existingLinks) {
    const key = getLinkDedupKey(link)
    const list = existingLinksByKey.get(key)
    if (list) list.push(link)
    else existingLinksByKey.set(key, [link])
  }

  const inserts: Array<NoteLinkRow> = []
  const patches: Array<{ linkId: Id<'noteLinks'>; updates: Partial<NoteLinkRow> }> = []
  const deletions: Array<Id<'noteLinks'>> = []

  for (const [key, desired] of desiredRowsByKey) {
    const matches = existingLinksByKey.get(key) ?? []
    const [kept, ...extras] = matches

    for (const extra of extras) {
      deletions.push(extra._id)
    }

    if (!kept) {
      inserts.push(desired)
      continue
    }

    const updates: Partial<NoteLinkRow> = {}
    if (kept.query !== desired.query) updates.query = desired.query
    if (kept.displayName !== desired.displayName) updates.displayName = desired.displayName
    if (kept.syntax !== desired.syntax) updates.syntax = desired.syntax

    if (Object.keys(updates).length > 0) {
      patches.push({ linkId: kept._id, updates })
    }
  }

  for (const [key, matches] of existingLinksByKey) {
    if (desiredRowsByKey.has(key)) continue
    for (const link of matches) {
      deletions.push(link._id)
    }
  }

  await Promise.all([
    ...deletions.map((linkId) => ctx.db.delete('noteLinks', linkId)),
    ...patches.map(({ linkId, updates }) => ctx.db.patch('noteLinks', linkId, updates)),
    ...inserts.map((row) => ctx.db.insert('noteLinks', row)),
  ])
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
