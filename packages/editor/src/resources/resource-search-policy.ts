import type { ResourceId } from './domain-id'

export const MAX_WORKSPACE_SEARCH_QUERY_BYTES = 512
export const MAX_WORKSPACE_SEARCH_QUERY_TERMS = 16
export const MAX_WORKSPACE_SEARCH_TERM_BYTES = 32
export const MAX_WORKSPACE_SEARCH_TITLE_BYTES = 2 * 1024
export const MAX_WORKSPACE_SEARCH_BODY_BYTES = 64 * 1024
export const MAX_WORKSPACE_SEARCH_DOCUMENT_READS = 64
export const MAX_WORKSPACE_SEARCH_RESULTS = 50
export const MAX_WORKSPACE_SEARCH_PROVIDER_READ_BYTES =
  (MAX_WORKSPACE_SEARCH_DOCUMENT_READS + MAX_WORKSPACE_SEARCH_RESULTS) *
  (MAX_WORKSPACE_SEARCH_BODY_BYTES + 2 * MAX_WORKSPACE_SEARCH_TITLE_BYTES + 1024)

export type ResourceSearchDocument = Readonly<{
  resourceId: ResourceId
  title: string
  body: string
}>

export type WorkspaceSearchResult = Readonly<{
  resourceId: ResourceId
  match: Readonly<{ type: 'title' }> | Readonly<{ type: 'body'; text: string }>
}>

export type WorkspaceSearchOutcome = Readonly<{
  status: 'complete' | 'incomplete'
  results: ReadonlyArray<WorkspaceSearchResult>
}>

export type ResourceSearchPage = Readonly<{
  documents: ReadonlyArray<ResourceSearchDocument>
  complete: boolean
}>

export type ResourceSearchProvider = Readonly<{
  titlePrefix(
    normalizedQuery: string,
    limit: number,
  ): ResourceSearchPage | Promise<ResourceSearchPage>
  titleMatches(
    normalizedQuery: string,
    limit: number,
  ): ResourceSearchPage | Promise<ResourceSearchPage>
  bodyMatches(
    normalizedQuery: string,
    limit: number,
  ): ResourceSearchPage | Promise<ResourceSearchPage>
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
  for (const document of documents) {
    const result = rankSearchDocument(document, normalized, terms)
    if (result) insertRankedResult(ranked, result)
  }
  return ranked.map(({ result }) => result)
}

export async function executeResourceSearchPlan(
  query: string,
  provider: ResourceSearchProvider,
): Promise<WorkspaceSearchOutcome> {
  const normalized = normalizeSearchQuery(query)
  if (!normalized) return { status: 'complete', results: [] }

  const prefix = await provider.titlePrefix(normalized, MAX_WORKSPACE_SEARCH_RESULTS)
  assertSearchPage(prefix, MAX_WORKSPACE_SEARCH_RESULTS)
  if (prefix.documents.length === MAX_WORKSPACE_SEARCH_RESULTS) {
    return completeSearch(prefix.documents, normalized)
  }

  let remainingReads = MAX_WORKSPACE_SEARCH_DOCUMENT_READS
  const title = await provider.titleMatches(normalized, remainingReads)
  assertSearchPage(title, remainingReads)
  if (!title.complete) return incompleteSearch(prefix.documents, normalized)

  remainingReads -= title.documents.length
  const titleDocuments = uniqueSearchDocuments([...prefix.documents, ...title.documents])
  const titleResults = searchResourceDocuments(titleDocuments, normalized)
  if (titleResults.length === MAX_WORKSPACE_SEARCH_RESULTS) {
    return { status: 'complete', results: titleResults }
  }
  if (remainingReads === 0) return { status: 'incomplete', results: titleResults }

  const body = await provider.bodyMatches(normalized, remainingReads)
  assertSearchPage(body, remainingReads)
  if (!body.complete) return { status: 'incomplete', results: titleResults }

  return completeSearch([...titleDocuments, ...body.documents], normalized)
}

function completeSearch(
  documents: ReadonlyArray<ResourceSearchDocument>,
  query: string,
): WorkspaceSearchOutcome {
  return {
    status: 'complete',
    results: searchResourceDocuments(uniqueSearchDocuments(documents), query),
  }
}

function incompleteSearch(
  documents: ReadonlyArray<ResourceSearchDocument>,
  query: string,
): WorkspaceSearchOutcome {
  return {
    status: 'incomplete',
    results: searchResourceDocuments(uniqueSearchDocuments(documents), query),
  }
}

function uniqueSearchDocuments(
  documents: ReadonlyArray<ResourceSearchDocument>,
): ReadonlyArray<ResourceSearchDocument> {
  return Array.from(new Map(documents.map((document) => [document.resourceId, document])).values())
}

function assertSearchPage(page: ResourceSearchPage, limit: number): void {
  if (page.documents.length > limit) throw new TypeError('Search provider exceeded its read limit')
}

export function normalizeSearchQuery(query: string): string {
  const normalized = foldCase(truncateUtf8(query, MAX_WORKSPACE_SEARCH_QUERY_BYTES))
  const terms = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu) ?? []
  return truncateUtf8(
    terms
      .slice(0, MAX_WORKSPACE_SEARCH_QUERY_TERMS)
      .map((term) => truncateUtf8(term, MAX_WORKSPACE_SEARCH_TERM_BYTES))
      .filter(Boolean)
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
  const title = normalizeResourceSearchText(document.title)
  if (matchesAllTerms(title, terms)) {
    return {
      result: { resourceId: document.resourceId, match: { type: 'title' } },
      score: title === query ? 4 : title.startsWith(query) ? 3 : title.includes(query) ? 2 : 1,
      title,
    }
  }
  const body = foldCase(document.body)
  if (!matchesAllTerms(normalizeResourceSearchText(document.body), terms)) return null
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
  const words = value.split(' ')
  return terms.every((term, index) =>
    index === terms.length - 1 ? words.some((word) => word.startsWith(term)) : words.includes(term),
  )
}

function searchExcerpt(text: string, index: number, length: number): string {
  const scalars = Array.from(text)
  const matchStart = originalScalarIndex(text, index)
  const matchLength = originalScalarIndex(text, index + length) - matchStart
  const start = Math.max(0, matchStart - 60)
  const end = Math.min(scalars.length, matchStart + matchLength + 100)
  return `${start > 0 ? '…' : ''}${scalars.slice(start, end).join('')}${end < scalars.length ? '…' : ''}`
}

function compareRankedSearchResults(left: RankedSearchResult, right: RankedSearchResult): number {
  return (
    right.score - left.score ||
    compareText(left.title, right.title) ||
    compareText(left.result.resourceId, right.result.resourceId)
  )
}

function insertRankedResult(
  ranked: Array<RankedSearchResult>,
  candidate: RankedSearchResult,
): void {
  let low = 0
  let high = ranked.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (compareRankedSearchResults(candidate, ranked[middle]!) < 0) high = middle
    else low = middle + 1
  }
  if (low >= MAX_WORKSPACE_SEARCH_RESULTS) return
  ranked.splice(low, 0, candidate)
  if (ranked.length > MAX_WORKSPACE_SEARCH_RESULTS) ranked.pop()
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

export function normalizeResourceSearchText(value: string): string {
  return (foldCase(value).match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu) ?? []).join(' ')
}

export function resourceSearchPrefixUpperBound(prefix: string): string {
  const scalars = Array.from(prefix)
  const last = scalars.pop()
  if (!last) throw new TypeError('Expected a non-empty search prefix')
  return scalars.join('') + String.fromCodePoint(last.codePointAt(0)! + 1)
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
