import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'

import { createItemContentLoadState } from '../load-state'

const itemId = 'item-1' as ResourceId

describe('createItemContentLoadState', () => {
  it('preserves falsy loaded item values as ready content', () => {
    expect(
      createItemContentLoadState({
        item: '',
        itemId,
        isPending: false,
      }),
    ).toEqual({ status: 'ready', item: '', isPending: false, error: null })

    expect(
      createItemContentLoadState({
        item: 0,
        itemId,
        isPending: false,
      }),
    ).toEqual({ status: 'ready', item: 0, isPending: false, error: null })

    expect(
      createItemContentLoadState({
        item: false,
        itemId,
        isPending: false,
      }),
    ).toEqual({ status: 'ready', item: false, isPending: false, error: null })
  })

  it('treats falsy error values as explicit load errors', () => {
    expect(
      createItemContentLoadState({
        error: '',
        item: 'ignored',
        itemId,
        isPending: false,
      }),
    ).toEqual({ status: 'error', item: null, isPending: false, error: '' })
  })
})
