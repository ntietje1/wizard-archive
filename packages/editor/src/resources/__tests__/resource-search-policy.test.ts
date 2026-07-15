import { describe, expect, it } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { MAX_WORKSPACE_SEARCH_RESULTS, searchResourceDocuments } from '../resource-search-policy'

describe('resource search policy', () => {
  it('ranks exact and prefix titles before body matches with deterministic excerpts', () => {
    const exact = testDomainId('resource', 'exact')
    const prefix = testDomainId('resource', 'prefix')
    const body = testDomainId('resource', 'body')
    expect(
      searchResourceDocuments(
        [
          { resourceId: body, title: 'Journal', body: 'The hidden citadel awaits.' },
          { resourceId: prefix, title: 'Citadel notes', body: '' },
          { resourceId: exact, title: 'Citadel', body: '' },
        ],
        'citadel',
      ),
    ).toEqual([
      { resourceId: exact, match: { type: 'title' } },
      { resourceId: prefix, match: { type: 'title' } },
      { resourceId: body, match: { type: 'body', text: 'The hidden citadel awaits.' } },
    ])
  })

  it('bounds results after applying the shared ranking policy', () => {
    const results = searchResourceDocuments(
      Array.from({ length: MAX_WORKSPACE_SEARCH_RESULTS + 10 }, (_, index) => ({
        resourceId: testDomainId('resource', `result-${index}`),
        title: `Result ${index}`,
        body: '',
      })),
      'result',
    )
    expect(results).toHaveLength(MAX_WORKSPACE_SEARCH_RESULTS)
  })
})
