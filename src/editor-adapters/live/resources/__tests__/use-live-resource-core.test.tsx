import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import { useLiveResourceCore } from '../use-live-resource-core'

const navigation = {
  current: () => null,
  open: vi.fn(),
  subscribe: () => () => {},
}

const convex = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn(), watchQuery: vi.fn() }))

vi.mock('@convex-dev/react-query', () => ({ useConvex: () => convex }))

const scope: ResourceProjectionScope = {
  campaignId: testDomainId('campaign', 'resource-core'),
  actorId: testDomainId('campaignMember', 'resource-core'),
  projection: 'dm',
  schema: RESOURCE_INDEX_SCHEMA,
}

describe('useLiveResourceCore', () => {
  beforeEach(() => {
    convex.query.mockReset()
    convex.mutation.mockReset()
    convex.watchQuery.mockReset()
    convex.watchQuery.mockReturnValue({
      localQueryResult: () => ({
        revision: 0,
        value: {
          mode: 'editor',
          sort: { by: 'title', direction: 'ascending' },
          panels: {
            left: { size: 288, visible: true },
            right: { size: 280, visible: false },
          },
        },
      }),
      onUpdate: () => () => {},
    })
  })

  it('preserves every capability identity within one authoritative scope', () => {
    const { result, rerender } = renderHook(
      ({ currentScope }) => useLiveResourceCore(currentScope, navigation),
      { initialProps: { currentScope: scope } },
    )
    const initial = result.current

    rerender({ currentScope: { ...scope } })

    expect(result.current.scope).toBe(initial.scope)
    expect(result.current.resources.index).toBe(initial.resources.index)
    expect(result.current.resources.loader).toBe(initial.resources.loader)
    expect(result.current.resources.structure).toBe(initial.resources.structure)
    expect(result.current.resources.structure.status).toBe('available')
    expect(result.current.content.notes).toBe(initial.content.notes)
    expect(result.current.content.files).toBe(initial.content.files)
    expect(result.current.content.maps).toBe(initial.content.maps)
    expect(result.current.content.canvases).toBe(initial.content.canvases)
    expect(result.current.navigation).toBe(navigation)
    expect(result.current.preferences).toBe(initial.preferences)
    expect(result.current.resources.access).toEqual({
      status: 'unavailable',
      reason: 'capability_not_supported',
    })
  })

  it('replaces every capability at a new actor projection scope boundary', () => {
    const initial = renderHook(() => useLiveResourceCore(scope, navigation)).result.current
    const next = renderHook(() =>
      useLiveResourceCore(
        {
          ...scope,
          actorId: testDomainId('campaignMember', 'other-actor'),
          projection: 'player',
        },
        navigation,
      ),
    ).result.current

    expect(next.scope).not.toBe(initial.scope)
    expect(next.resources.index).not.toBe(initial.resources.index)
    expect(next.resources.loader).not.toBe(initial.resources.loader)
    expect(next.resources.structure).not.toBe(initial.resources.structure)
    expect(next.resources.structure).toEqual({
      status: 'unavailable',
      reason: 'unauthorized',
    })
    expect(next.content.notes).not.toBe(initial.content.notes)
    expect(next.content.files).not.toBe(initial.content.files)
    expect(next.content.maps).not.toBe(initial.content.maps)
    expect(next.content.canvases).not.toBe(initial.content.canvases)
    expect(next.preferences).not.toBe(initial.preferences)
  })
})
