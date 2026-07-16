import type { ResourceId } from './domain-id'
import {
  MAX_WORKSPACE_SEARCH_TERM_BYTES,
  executeResourceSearchPlan,
  normalizeResourceSearchText,
} from './resource-search-policy'
import type {
  ResourceSearchDocument,
  ResourceSearchPage,
  WorkspaceSearchOutcome,
} from './resource-search-policy'

type IndexedSearchDocument = Readonly<{
  document: ResourceSearchDocument
  normalizedTitle: string
}>

type Posting = Array<ResourceId>

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

  search(query: string): Promise<WorkspaceSearchOutcome> {
    return executeResourceSearchPlan(query, {
      titlePrefix: (normalized, limit) => this.#titlePrefix(normalized, limit),
      titleMatches: (normalized, limit) =>
        this.#matches(normalized, this.#titleTerms, this.#titlePrefixes, limit),
      bodyMatches: (normalized, limit) =>
        this.#matches(normalized, this.#bodyTerms, this.#bodyPrefixes, limit),
    })
  }

  clear(): void {
    this.#documents.clear()
    this.#ranked.length = 0
    this.#titleTerms.clear()
    this.#titlePrefixes.clear()
    this.#bodyTerms.clear()
    this.#bodyPrefixes.clear()
  }

  #titlePrefix(query: string, limit: number): ResourceSearchPage {
    const start = lowerBound(this.#ranked, (resourceId) => {
      const title = this.#documents.get(resourceId)!.normalizedTitle
      return compareText(query, title)
    })
    const matches: Array<ResourceSearchDocument> = []
    for (let index = start; index < this.#ranked.length; index += 1) {
      const resourceId = this.#ranked[index]!
      if (!this.#documents.get(resourceId)!.normalizedTitle.startsWith(query)) break
      matches.push(this.#documents.get(resourceId)!.document)
      if (matches.length === limit) break
    }
    return { documents: matches, complete: true }
  }

  #matches(
    normalizedQuery: string,
    exactPostings: ReadonlyMap<string, Posting>,
    prefixPostings: ReadonlyMap<string, Posting>,
    limit: number,
  ): ResourceSearchPage {
    const terms = normalizedQuery.split(' ')
    const postings = terms.map((term, index) =>
      (index === terms.length - 1 ? prefixPostings : exactPostings).get(term),
    )
    if (postings.some((candidate) => !candidate)) return { documents: [], complete: true }
    const available = postings as ReadonlyArray<Posting>
    const first = available.reduce((smallest, candidate) =>
      candidate.length < smallest.length ? candidate : smallest,
    )
    const documents: Array<ResourceSearchDocument> = []
    for (const resourceId of first) {
      const matches = available.every((candidate) => this.#has(candidate, resourceId))
      if (!matches) continue
      if (documents.length === limit) return { documents, complete: false }
      documents.push(this.#documents.get(resourceId)!.document)
    }
    return { documents, complete: true }
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
