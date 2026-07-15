import type { ResourceId } from './domain-id'
import type { WorkspaceSearchResult } from './editor-runtime-contract'

export const MAX_WORKSPACE_SEARCH_QUERY_LENGTH = 200
export const MAX_WORKSPACE_SEARCH_RESULTS = 50

export type ResourceSearchDocument = Readonly<{
  resourceId: ResourceId
  title: string
  body: string
}>

type RankedSearchResult = Readonly<{
  result: WorkspaceSearchResult
  score: number
  title: string
}>

export function searchResourceDocuments(
  documents: ReadonlyArray<ResourceSearchDocument>,
  query: string,
): ReadonlyArray<WorkspaceSearchResult> {
  const normalized = normalizeSearchQuery(query)
  if (!normalized) return []
  const terms = normalized.split(' ')
  const ranked = documents.flatMap((document) => {
    const result = rankSearchDocument(document, normalized, terms)
    return result ? [result] : []
  })
  ranked.sort(
    (left, right) =>
      right.score - left.score ||
      left.title.localeCompare(right.title) ||
      left.result.resourceId.localeCompare(right.result.resourceId),
  )
  return ranked.slice(0, MAX_WORKSPACE_SEARCH_RESULTS).map(({ result }) => result)
}

export function normalizeSearchQuery(query: string): string {
  return query
    .slice(0, MAX_WORKSPACE_SEARCH_QUERY_LENGTH)
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .join(' ')
}

function rankSearchDocument(
  document: ResourceSearchDocument,
  query: string,
  terms: ReadonlyArray<string>,
): RankedSearchResult | null {
  const title = document.title.toLocaleLowerCase()
  if (matchesAllTerms(title, terms)) {
    return {
      result: { resourceId: document.resourceId, match: { type: 'title' } },
      score: title === query ? 4 : title.startsWith(query) ? 3 : title.includes(query) ? 2 : 1,
      title,
    }
  }
  const body = document.body.toLocaleLowerCase()
  if (!matchesAllTerms(body, terms)) return null
  const firstMatch = Math.min(
    ...terms.map((term) => body.indexOf(term)).filter((index) => index >= 0),
  )
  return {
    result: {
      resourceId: document.resourceId,
      match: {
        type: 'body',
        text: searchExcerpt(document.body, firstMatch, terms[0]?.length ?? 0),
      },
    },
    score: 0,
    title,
  }
}

function matchesAllTerms(value: string, terms: ReadonlyArray<string>): boolean {
  return terms.every((term) => value.includes(term))
}

function searchExcerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 60)
  const end = Math.min(text.length, index + length + 100)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}
