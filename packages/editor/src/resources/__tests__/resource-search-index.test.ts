import { describe, expect, it } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { ResourceSearchIndex } from '../resource-search-index'
import {
  MAX_WORKSPACE_SEARCH_CANDIDATES,
  MAX_WORKSPACE_SEARCH_RESULTS,
  createResourceSearchDocument,
  searchResourceDocuments,
} from '../resource-search-policy'

describe('ResourceSearchIndex', () => {
  it('returns the global top results without visiting the campaign corpus', () => {
    const documents = Array.from({ length: MAX_WORKSPACE_SEARCH_CANDIDATES + 2 }, (_, index) =>
      createResourceSearchDocument(
        testDomainId('resource', `bounded-search-${index}`),
        `Journal ${index.toString().padStart(4, '0')}`,
        'Shared archive',
      ),
    )
    const index = new ResourceSearchIndex()
    for (const document of [...documents].reverse()) index.set(document)

    const result = index.search('archive')

    expect(result.complete).toBe(true)
    expect(result.documentsVisited).toBe(MAX_WORKSPACE_SEARCH_RESULTS)
    expect(result.results).toEqual(searchResourceDocuments(documents, 'archive'))
  })

  it('reserves exact and full-title-prefix matches beyond generic postings', () => {
    const exact = createResourceSearchDocument(
      testDomainId('resource', 'bounded-search-exact'),
      'Needle',
      '',
    )
    const documents = [
      ...Array.from({ length: MAX_WORKSPACE_SEARCH_CANDIDATES + 2 }, (_, index) =>
        createResourceSearchDocument(
          testDomainId('resource', `bounded-search-body-${index}`),
          `Archive ${index.toString().padStart(4, '0')}`,
          'Needle in the haystack',
        ),
      ),
      exact,
    ]
    const index = new ResourceSearchIndex()
    for (const document of documents) index.set(document)

    const result = index.search('needle')

    expect(result.complete).toBe(true)
    expect(result.results).toEqual(searchResourceDocuments(documents, 'needle'))
    expect(result.results[0]).toEqual({ resourceId: exact.resourceId, match: { type: 'title' } })
  })

  it('updates posting order on rename and removes obsolete title and body terms', () => {
    const resourceId = testDomainId('resource', 'bounded-search-updated')
    const index = new ResourceSearchIndex()
    index.set(createResourceSearchDocument(resourceId, 'Old title', 'Hidden citadel'))

    expect(index.search('citadel').results).toHaveLength(1)
    index.set(createResourceSearchDocument(resourceId, 'Renamed archive', 'Sunken vault'))

    expect(index.search('old').results).toEqual([])
    expect(index.search('citadel').results).toEqual([])
    expect(index.search('renamed').results).toEqual([{ resourceId, match: { type: 'title' } }])
    expect(index.search('vault').results).toEqual([
      { resourceId, match: { type: 'body', text: 'Sunken vault' } },
    ])

    index.delete(resourceId)
    expect(index.search('renamed').results).toEqual([])
  })

  it('fully ranks multi-term title phrases before lower-ranked term matches', () => {
    const phrase = createResourceSearchDocument(
      testDomainId('resource', 'bounded-search-phrase'),
      'Z alpha beta',
      '',
    )
    const documents = [
      ...Array.from({ length: 60 }, (_, value) =>
        createResourceSearchDocument(
          testDomainId('resource', `bounded-search-terms-${value}`),
          `A${value.toString().padStart(2, '0')} alpha gap beta`,
          '',
        ),
      ),
      phrase,
    ]
    const index = new ResourceSearchIndex()
    for (const document of documents) index.set(document)

    const result = index.search('alpha beta')

    expect(result.complete).toBe(true)
    expect(result.results).toEqual(searchResourceDocuments(documents, 'alpha beta'))
    expect(result.results[0]).toEqual({ resourceId: phrase.resourceId, match: { type: 'title' } })
  })

  it('reports an incomplete conjunctive query instead of returning a wrong bounded rank', () => {
    const index = new ResourceSearchIndex()
    for (let value = 0; value < MAX_WORKSPACE_SEARCH_CANDIDATES * 2 + 1; value += 1) {
      const inFirstPosting = value <= MAX_WORKSPACE_SEARCH_CANDIDATES
      const inSecondPosting = value >= MAX_WORKSPACE_SEARCH_CANDIDATES
      index.set(
        createResourceSearchDocument(
          testDomainId('resource', `bounded-search-intersection-${value}`),
          `Document ${value.toString().padStart(5, '0')}`,
          [inFirstPosting ? 'alpha' : '', inSecondPosting ? 'beta' : ''].filter(Boolean).join(' '),
        ),
      )
    }

    const result = index.search('alpha beta')

    expect(result.complete).toBe(false)
    expect(result.documentsVisited).toBe(MAX_WORKSPACE_SEARCH_CANDIDATES)
    expect(result.results).toEqual([])
  })
})
