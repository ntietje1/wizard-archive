import type { ResourceId } from './domain-id'
import type { WorkspaceSearchResult } from './editor-runtime-contract'

export const MAX_WORKSPACE_SEARCH_QUERY_BYTES = 512
export const MAX_WORKSPACE_SEARCH_QUERY_TERMS = 16
export const MAX_WORKSPACE_SEARCH_TERM_SCALARS = 32
export const MAX_WORKSPACE_SEARCH_TITLE_BYTES = 2 * 1024
export const MAX_WORKSPACE_SEARCH_BODY_BYTES = 64 * 1024
export const MAX_WORKSPACE_SEARCH_CANDIDATES = 200
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
  const ranked: Array<RankedSearchResult> = []
  for (const document of selectSearchCandidates(documents)) {
    const result = rankSearchDocument(document, normalized, terms)
    if (result) ranked.push(result)
  }
  ranked.sort(compareRankedSearchResults)
  return ranked.slice(0, MAX_WORKSPACE_SEARCH_RESULTS).map(({ result }) => result)
}

export function normalizeSearchQuery(query: string): string {
  const normalized = foldCase(truncateUtf8(query, MAX_WORKSPACE_SEARCH_QUERY_BYTES))
  const terms = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu) ?? []
  return truncateUtf8(
    terms
      .slice(0, MAX_WORKSPACE_SEARCH_QUERY_TERMS)
      .map((term) => Array.from(term).slice(0, MAX_WORKSPACE_SEARCH_TERM_SCALARS).join(''))
      .join(' '),
    MAX_WORKSPACE_SEARCH_QUERY_BYTES,
  )
}

export function createResourceSearchDocument(
  resourceId: ResourceId,
  title: string,
  body: string,
): ResourceSearchDocument {
  return {
    resourceId,
    title: truncateUtf8(title, MAX_WORKSPACE_SEARCH_TITLE_BYTES),
    body: truncateUtf8(body, MAX_WORKSPACE_SEARCH_BODY_BYTES),
  }
}

function rankSearchDocument(
  document: ResourceSearchDocument,
  query: string,
  terms: ReadonlyArray<string>,
): RankedSearchResult | null {
  const title = foldCase(document.title)
  if (matchesAllTerms(title, terms)) {
    return {
      result: { resourceId: document.resourceId, match: { type: 'title' } },
      score: title === query ? 4 : title.startsWith(query) ? 3 : title.includes(query) ? 2 : 1,
      title,
    }
  }
  const body = foldCase(document.body)
  if (!matchesAllTerms(body, terms)) return null
  const firstMatch = Math.min(...terms.map((term) => body.indexOf(term)))
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
  const scalars = Array.from(text)
  const matchStart = originalScalarIndex(text, index)
  const matchLength = originalScalarIndex(text, index + length) - matchStart
  const start = Math.max(0, matchStart - 60)
  const end = Math.min(scalars.length, matchStart + matchLength + 100)
  return `${start > 0 ? '…' : ''}${scalars.slice(start, end).join('')}${end < scalars.length ? '…' : ''}`
}

function selectSearchCandidates(
  documents: ReadonlyArray<ResourceSearchDocument>,
): ReadonlyArray<ResourceSearchDocument> {
  const candidates: Array<ResourceSearchDocument> = []
  for (const document of documents) {
    let low = 0
    let high = candidates.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (compareText(document.resourceId, candidates[middle]!.resourceId) < 0) high = middle
      else low = middle + 1
    }
    candidates.splice(low, 0, document)
    if (candidates.length > MAX_WORKSPACE_SEARCH_CANDIDATES) candidates.pop()
  }
  return candidates
}

function compareRankedSearchResults(left: RankedSearchResult, right: RankedSearchResult): number {
  return (
    right.score - left.score ||
    compareText(left.title, right.title) ||
    compareText(left.result.resourceId, right.result.resourceId)
  )
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function originalScalarIndex(text: string, foldedOffset: number): number {
  let foldedLength = 0
  let scalarIndex = 0
  for (const scalar of text) {
    if (foldedLength >= foldedOffset) return scalarIndex
    foldedLength += foldCase(scalar).length
    scalarIndex += 1
  }
  return scalarIndex
}

function foldCase(value: string): string {
  return Array.from(value, (scalar) => scalar.toLowerCase()).join('')
}

function truncateUtf8(value: string, maxBytes: number): string {
  const bytes = new TextEncoder().encode(value)
  if (bytes.length <= maxBytes) return new TextDecoder().decode(bytes)
  const decoder = new TextDecoder('utf-8', { fatal: true })
  for (let end = maxBytes; end > Math.max(0, maxBytes - 4); end -= 1) {
    try {
      return decoder.decode(bytes.subarray(0, end))
    } catch {
      continue
    }
  }
  return ''
}
