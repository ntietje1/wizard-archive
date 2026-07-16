import { describe, expect, it } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import {
  MAX_WORKSPACE_SEARCH_BODY_BYTES,
  MAX_WORKSPACE_SEARCH_QUERY_TERMS,
  MAX_WORKSPACE_SEARCH_RESULTS,
  MAX_WORKSPACE_SEARCH_TERM_SCALARS,
  createResourceSearchDocument,
  normalizeSearchQuery,
  searchResourceDocuments,
} from '../resource-search-policy'

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

  it('bounds query terms and casing with locale-independent Unicode semantics', () => {
    const term = '𐐀'.repeat(MAX_WORKSPACE_SEARCH_TERM_SCALARS + 1)
    const normalized = normalizeSearchQuery(
      ['İ', term, ...Array.from({ length: MAX_WORKSPACE_SEARCH_QUERY_TERMS }, () => 'extra')].join(
        '---',
      ),
    )

    expect(normalized.split(' ')).toHaveLength(MAX_WORKSPACE_SEARCH_QUERY_TERMS)
    expect(normalized.split(' ')[0]).toBe('i̇')
    expect(Array.from(normalized.split(' ')[1]!)).toHaveLength(MAX_WORKSPACE_SEARCH_TERM_SCALARS)
  })

  it('caps stored search text at complete UTF-8 scalars', () => {
    const document = createResourceSearchDocument(
      testDomainId('resource', 'bounded'),
      'Title',
      `${'a'.repeat(MAX_WORKSPACE_SEARCH_BODY_BYTES - 1)}🧙trailing`,
    )

    expect(new TextEncoder().encode(document.body).byteLength).toBeLessThanOrEqual(
      MAX_WORKSPACE_SEARCH_BODY_BYTES,
    )
    expect(document.body).toBe('a'.repeat(MAX_WORKSPACE_SEARCH_BODY_BYTES - 1))
    expect(document.body).not.toContain('�')
  })

  it('uses code-point ordering rather than the host locale', () => {
    const ascii = testDomainId('resource', 'ascii')
    const accented = testDomainId('resource', 'accented')

    expect(
      searchResourceDocuments(
        [
          { resourceId: accented, title: 'Ä result', body: '' },
          { resourceId: ascii, title: 'Z result', body: '' },
        ],
        'result',
      ),
    ).toEqual([
      { resourceId: ascii, match: { type: 'title' } },
      { resourceId: accented, match: { type: 'title' } },
    ])
  })
})
