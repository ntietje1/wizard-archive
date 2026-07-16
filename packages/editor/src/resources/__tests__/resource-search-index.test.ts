import { describe, expect, it } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { ResourceSearchIndex } from '../resource-search-index'
import {
  MAX_WORKSPACE_SEARCH_DOCUMENT_READS,
  MAX_WORKSPACE_SEARCH_RESULTS,
  createResourceSearchDocument,
  searchResourceDocuments,
} from '../resource-search-policy'

describe('ResourceSearchIndex', () => {
  it('returns the global top results without visiting the campaign corpus', async () => {
    const documents = Array.from({ length: 60 }, (_, index) =>
      createResourceSearchDocument(
        testDomainId('resource', `bounded-search-${index}`),
        `Journal ${index.toString().padStart(4, '0')}`,
        'Shared archive',
      ),
    )
    const index = new ResourceSearchIndex()
    for (const document of [...documents].reverse()) index.set(document)

    const result = await index.search('archive')

    expect(result.status).toBe('complete')
    expect(result.results).toEqual(searchResourceDocuments(documents, 'archive'))
  })

  it('reserves exact and full-title-prefix matches beyond generic postings', async () => {
    const exact = createResourceSearchDocument(
      testDomainId('resource', 'bounded-search-exact'),
      'Needle',
      '',
    )
    const documents = [
      ...Array.from({ length: 1_025 }, (_, index) =>
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

    const result = await index.search('needle')

    expect(result.status).toBe('incomplete')
    expect(result.results).toEqual([{ resourceId: exact.resourceId, match: { type: 'title' } }])
    expect(result.results[0]).toEqual({ resourceId: exact.resourceId, match: { type: 'title' } })
  })

  it('updates posting order on rename and removes obsolete title and body terms', async () => {
    const resourceId = testDomainId('resource', 'bounded-search-updated')
    const index = new ResourceSearchIndex()
    index.set(createResourceSearchDocument(resourceId, 'Old title', 'Hidden citadel'))

    expect((await index.search('citadel')).results).toHaveLength(1)
    index.set(createResourceSearchDocument(resourceId, 'Renamed archive', 'Sunken vault'))

    expect((await index.search('old')).results).toEqual([])
    expect((await index.search('citadel')).results).toEqual([])
    expect((await index.search('renamed')).results).toEqual([
      { resourceId, match: { type: 'title' } },
    ])
    expect((await index.search('vault')).results).toEqual([
      { resourceId, match: { type: 'body', text: 'Sunken vault' } },
    ])

    index.delete(resourceId)
    expect((await index.search('renamed')).results).toEqual([])
  })

  it('fully ranks multi-term title phrases before lower-ranked term matches', async () => {
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

    const result = await index.search('alpha beta')

    expect(result.status).toBe('complete')
    expect(result.results).toEqual(searchResourceDocuments(documents, 'alpha beta'))
    expect(result.results[0]).toEqual({ resourceId: phrase.resourceId, match: { type: 'title' } })
  })

  it('finds a sparse conjunctive match without charging unrelated postings', async () => {
    const index = new ResourceSearchIndex()
    for (let value = 0; value < MAX_WORKSPACE_SEARCH_DOCUMENT_READS * 2 + 1; value += 1) {
      const inFirstPosting = value <= MAX_WORKSPACE_SEARCH_DOCUMENT_READS
      const inSecondPosting = value >= MAX_WORKSPACE_SEARCH_DOCUMENT_READS
      index.set(
        createResourceSearchDocument(
          testDomainId('resource', `bounded-search-intersection-${value}`),
          `Document ${value.toString().padStart(5, '0')}`,
          [inFirstPosting ? 'alpha' : '', inSecondPosting ? 'beta' : ''].filter(Boolean).join(' '),
        ),
      )
    }

    const result = await index.search('alpha beta')

    expect(result.status).toBe('complete')
    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.match).toEqual({ type: 'body', text: 'alpha beta' })
  })

  it('uses one read budget across disjoint title and body stages', async () => {
    const index = new ResourceSearchIndex()
    for (let value = 0; value < MAX_WORKSPACE_SEARCH_RESULTS - 1; value += 1) {
      index.set(
        createResourceSearchDocument(
          testDomainId('resource', `bounded-search-title-${value}`),
          `Archive ${value.toString().padStart(3, '0')} needle`,
          '',
        ),
      )
    }
    for (let value = 0; value < 16; value += 1) {
      index.set(
        createResourceSearchDocument(
          testDomainId('resource', `bounded-search-body-after-title-budget-${value}`),
          `Z body result ${value}`,
          'needle',
        ),
      )
    }

    const result = await index.search('needle')

    expect(result.status).toBe('incomplete')
    expect(result.results).toHaveLength(MAX_WORKSPACE_SEARCH_RESULTS - 1)
  })
})
