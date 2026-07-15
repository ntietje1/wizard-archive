import { noteBlocksPlainText } from '@wizard-archive/editor/notes/document-text'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { WorkspaceSearchResult } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { CampaignQueryCtx } from '../../functions'
import { findNoteContent } from './noteContent'

type ScoredResult = Readonly<{ result: WorkspaceSearchResult; score: number; title: string }>

export async function searchResources(
  ctx: CampaignQueryCtx,
  query: string,
): Promise<ReadonlyArray<WorkspaceSearchResult>> {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return []
  const resources = await ctx.db
    .query('resources')
    .withIndex('by_campaign_and_lifecycle', (index) =>
      index.eq('campaignUuid', ctx.resourceScope.campaignId).eq('lifecycle', 'active'),
    )
    .take(1000)
  const titleMatches: Array<ScoredResult> = []
  const unmatchedNotes = []
  for (const resource of resources) {
    const title = resource.title.toLocaleLowerCase()
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, resource.resourceUuid)
    if (title.includes(normalized)) {
      titleMatches.push({
        result: { resourceId, match: { type: 'title' } },
        score: title === normalized ? 3 : title.startsWith(normalized) ? 2 : 1,
        title,
      })
    } else if (resource.kind === 'note') {
      unmatchedNotes.push(resource)
    }
  }
  titleMatches.sort(
    (left, right) => right.score - left.score || left.title.localeCompare(right.title),
  )
  const bodyMatches = await Promise.all(
    unmatchedNotes.map(async (resource): Promise<WorkspaceSearchResult | null> => {
      const content = await findNoteContent(
        ctx.db,
        assertDomainId(DOMAIN_ID_KIND.resource, resource.resourceUuid),
      )
      if (!content || content.state !== 'ready') return null
      let text: string
      try {
        text = noteBlocksPlainText(
          decodeNoteYjsUpdatesToBlocks([{ update: content.update }], NOTE_YJS_FRAGMENT),
        )
      } catch {
        return null
      }
      const index = text.toLocaleLowerCase().indexOf(normalized)
      if (index < 0) return null
      return {
        resourceId: assertDomainId(DOMAIN_ID_KIND.resource, resource.resourceUuid),
        match: { type: 'body', text: searchExcerpt(text, index, normalized.length) },
      }
    }),
  )
  return [
    ...titleMatches.map(({ result }) => result),
    ...bodyMatches.filter((result) => result !== null),
  ]
}

function searchExcerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 60)
  const end = Math.min(text.length, index + length + 100)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}
