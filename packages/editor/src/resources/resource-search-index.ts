import type { ResourceId } from './domain-id'
import type { WorkspaceSearchResult } from './editor-runtime-contract'
import {
  MAX_WORKSPACE_SEARCH_CANDIDATES,
  MAX_WORKSPACE_SEARCH_RESULTS,
  MAX_WORKSPACE_SEARCH_TERM_BYTES,
  normalizeResourceSearchText,
  normalizeSearchQuery,
  searchResourceDocuments,
} from './resource-search-policy'
import type { ResourceSearchDocument } from './resource-search-policy'

type IndexedSearchDocument = Readonly<{
  document: ResourceSearchDocument
  normalizedTitle: string
}>

type Posting = Array<ResourceId>

type ResourceSearchQueryResult = Readonly<{
  results: ReadonlyArray<WorkspaceSearchResult>
  documentsVisited: number
  complete: boolean
}>

export class ResourceSearchIndex {
  readonly #documents = new Map<ResourceId, IndexedSearchDocument>()
  readonly #ranked: Posting = []
  readonly #titleTerms = new Map<string, Posting>()
  readonly #titlePrefixes = new Map<string, Posting>()
  readonly #bodyTerms = new Map<string, Posting>()
  readonly #bodyPrefixes = new Map<string, Posting>()

  set(document: ResourceSearchDocument): void {
    this.delete(document.resourceId)
    const titleTerms = searchTerms(document.title)
    const bodyTerms = searchTerms(document.body)
    const indexed = {
      document,
      normalizedTitle: normalizeResourceSearchText(document.title),
    }
    this.#documents.set(document.resourceId, indexed)
    this.#insert(this.#ranked, document.resourceId)
    this.#insertKeys(this.#titleTerms, titleTerms, document.resourceId)
    this.#insertKeys(this.#titlePrefixes, searchPrefixes(titleTerms), document.resourceId)
    this.#insertKeys(this.#bodyTerms, bodyTerms, document.resourceId)
    this.#insertKeys(this.#bodyPrefixes, searchPrefixes(bodyTerms), document.resourceId)
  }

  delete(resourceId: ResourceId): void {
    const indexed = this.#documents.get(resourceId)
    if (!indexed) return
    const titleTerms = searchTerms(indexed.document.title)
    const bodyTerms = searchTerms(indexed.document.body)
    this.#remove(this.#ranked, resourceId)
    this.#removeKeys(this.#titleTerms, titleTerms, resourceId)
    this.#removeKeys(this.#titlePrefixes, searchPrefixes(titleTerms), resourceId)
    this.#removeKeys(this.#bodyTerms, bodyTerms, resourceId)
    this.#removeKeys(this.#bodyPrefixes, searchPrefixes(bodyTerms), resourceId)
    this.#documents.delete(resourceId)
  }

  get(resourceId: ResourceId): ResourceSearchDocument | undefined {
    return this.#documents.get(resourceId)?.document
  }

  ids(): IterableIterator<ResourceId> {
    return this.#documents.keys()
  }

  search(query: string): ResourceSearchQueryResult {
    const normalized = normalizeSearchQuery(query)
    if (!normalized) return { results: [], documentsVisited: 0, complete: true }
    const terms = normalized.split(' ')
    const candidates = new Map<ResourceId, ResourceSearchDocument>()
    let documentsVisited = 0
    let workExhausted = false
    const visit = (
      resourceId: ResourceId,
      include: boolean,
      stopAtResultLimit: boolean,
    ): boolean => {
      if (documentsVisited === MAX_WORKSPACE_SEARCH_CANDIDATES) {
        workExhausted = true
        return false
      }
      documentsVisited += 1
      const document = include ? this.#documents.get(resourceId)?.document : null
      if (document) candidates.set(resourceId, document)
      if (stopAtResultLimit && candidates.size === MAX_WORKSPACE_SEARCH_RESULTS) return false
      return true
    }

    for (const resourceId of this.#titlePrefix(normalized)) {
      if (!visit(resourceId, true, true)) break
    }
    if (candidates.size < MAX_WORKSPACE_SEARCH_RESULTS) {
      this.#visitMatches(terms, this.#titleTerms, this.#titlePrefixes, terms.length === 1, visit)
    }
    if (candidates.size < MAX_WORKSPACE_SEARCH_RESULTS) {
      this.#visitMatches(terms, this.#bodyTerms, this.#bodyPrefixes, true, visit)
    }
    return {
      results: searchResourceDocuments(Array.from(candidates.values()), normalized),
      documentsVisited,
      complete: !workExhausted,
    }
  }

  clear(): void {
    this.#documents.clear()
    this.#ranked.length = 0
    this.#titleTerms.clear()
    this.#titlePrefixes.clear()
    this.#bodyTerms.clear()
    this.#bodyPrefixes.clear()
  }

  #titlePrefix(query: string): ReadonlyArray<ResourceId> {
    const start = lowerBound(this.#ranked, (resourceId) => {
      const title = this.#documents.get(resourceId)!.normalizedTitle
      return compareText(query, title)
    })
    const matches: Array<ResourceId> = []
    for (let index = start; index < this.#ranked.length; index += 1) {
      const resourceId = this.#ranked[index]!
      if (!this.#documents.get(resourceId)!.normalizedTitle.startsWith(query)) break
      matches.push(resourceId)
      if (matches.length === MAX_WORKSPACE_SEARCH_RESULTS) break
    }
    return matches
  }

  #visitMatches(
    terms: ReadonlyArray<string>,
    exactPostings: ReadonlyMap<string, Posting>,
    prefixPostings: ReadonlyMap<string, Posting>,
    stopAtResultLimit: boolean,
    visit: (resourceId: ResourceId, include: boolean, stopAtResultLimit: boolean) => boolean,
  ): void {
    const postings = terms.map((term, index) =>
      (index === terms.length - 1 ? prefixPostings : exactPostings).get(term),
    )
    if (postings.some((candidate) => !candidate)) return
    const available = postings as ReadonlyArray<Posting>
    const first = available.reduce((smallest, candidate) =>
      candidate.length < smallest.length ? candidate : smallest,
    )
    for (const resourceId of first) {
      const matches = available.every((candidate) => this.#has(candidate, resourceId))
      if (!visit(resourceId, matches, stopAtResultLimit)) return
    }
  }

  #insertKeys(postings: Map<string, Posting>, keys: ReadonlySet<string>, resourceId: ResourceId) {
    for (const key of keys) {
      const value = postings.get(key) ?? posting()
      postings.set(key, value)
      this.#insert(value, resourceId)
    }
  }

  #removeKeys(postings: Map<string, Posting>, keys: ReadonlySet<string>, resourceId: ResourceId) {
    for (const key of keys) {
      const value = postings.get(key)
      if (!value) continue
      this.#remove(value, resourceId)
      if (value.length === 0) postings.delete(key)
    }
  }

  #insert(value: Posting, resourceId: ResourceId): void {
    const index = lowerBound(value, (candidate) => this.#compare(resourceId, candidate))
    value.splice(index, 0, resourceId)
  }

  #remove(value: Posting, resourceId: ResourceId): void {
    const index = lowerBound(value, (candidate) => this.#compare(resourceId, candidate))
    if (value[index] === resourceId) value.splice(index, 1)
  }

  #has(value: Posting, resourceId: ResourceId): boolean {
    const index = lowerBound(value, (candidate) => this.#compare(resourceId, candidate))
    return value[index] === resourceId
  }

  #compare(leftId: ResourceId, rightId: ResourceId): number {
    const left = this.#documents.get(leftId)!
    const right = this.#documents.get(rightId)!
    return compareText(left.normalizedTitle, right.normalizedTitle) || compareText(leftId, rightId)
  }
}

function posting(): Posting {
  return []
}

function searchTerms(value: string): ReadonlySet<string> {
  const normalized = normalizeResourceSearchText(value)
  return new Set(normalized ? normalized.split(' ') : [])
}

function searchPrefixes(terms: ReadonlySet<string>): ReadonlySet<string> {
  const prefixes = new Set<string>()
  for (const term of terms) {
    let prefix = ''
    for (const scalar of term) {
      const next = prefix + scalar
      if (new TextEncoder().encode(next).byteLength > MAX_WORKSPACE_SEARCH_TERM_BYTES) break
      prefix = next
      prefixes.add(prefix)
    }
  }
  return prefixes
}

function lowerBound<T>(values: ReadonlyArray<T>, compare: (value: T) => number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (compare(values[middle]!) > 0) low = middle + 1
    else high = middle
  }
  return low
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
