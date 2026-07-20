import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import {
  MAX_RESOURCE_BOOKMARK_MUTATION_RESOURCES,
  parseResourceBookmarkSelection,
} from '../resource-bookmarks'

describe('resource bookmarks', () => {
  it('normalizes a bounded set-state selection', () => {
    const first = generateDomainId(DOMAIN_ID_KIND.resource)
    const second = generateDomainId(DOMAIN_ID_KIND.resource)

    expect(parseResourceBookmarkSelection([second, first, second])).toEqual({
      status: 'accepted',
      resourceIds: [first, second].sort(),
    })
  })

  it('rejects empty, invalid, and oversized selections', () => {
    expect(parseResourceBookmarkSelection([])).toEqual({
      status: 'rejected',
      reason: 'invalid_request',
    })
    expect(parseResourceBookmarkSelection(['not-a-resource-id'])).toEqual({
      status: 'rejected',
      reason: 'invalid_request',
    })
    expect(
      parseResourceBookmarkSelection(
        Array.from({ length: MAX_RESOURCE_BOOKMARK_MUTATION_RESOURCES + 1 }, () =>
          generateDomainId(DOMAIN_ID_KIND.resource),
        ),
      ),
    ).toEqual({ status: 'rejected', reason: 'selection_too_large' })
  })
})
