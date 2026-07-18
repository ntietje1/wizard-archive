import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import { useLiveResourceCore } from '../use-live-resource-core'
import type { EditorRuntime } from '@wizard-archive/editor/resources/editor-runtime-contract'

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
      ({ currentScope }) =>
        useLiveResourceCore(currentScope, navigation, { name: 'Editor', color: '#61afef' }),
      { initialProps: { currentScope: scope } },
    )
    const initial = requireRuntime(result.current)

    rerender({ currentScope: { ...scope } })

    const current = requireRuntime(result.current)
    expect(current.scope).toBe(initial.scope)
    expect(current.resources.index).toBe(initial.resources.index)
    expect(current.resources.loader).toBe(initial.resources.loader)
    expect(current.resources.structure).toBe(initial.resources.structure)
    expect(current.resources.structure.status).toBe('available')
    expect(current.content.notes).toBe(initial.content.notes)
    expect(current.content.files).toBe(initial.content.files)
    expect(current.content.maps).toBe(initial.content.maps)
    expect(current.content.canvases).toBe(initial.content.canvases)
    expect(current.navigation).toBe(navigation)
    expect(current.preferences).toBe(initial.preferences)
    expect(current.resources.access).toBe(initial.resources.access)
    expect(current.resources.access.status).toBe('available')
  })

  it('replaces every capability at a new actor projection scope boundary', () => {
    const initial = requireRuntime(
      renderHook(() => useLiveResourceCore(scope, navigation, { name: 'Editor', color: '#61afef' }))
        .result.current,
    )
    const next = requireRuntime(
      renderHook(() =>
        useLiveResourceCore(
          {
            ...scope,
            actorId: testDomainId('campaignMember', 'other-actor'),
            projection: 'player',
          },
          navigation,
          { name: 'Editor', color: '#61afef' },
        ),
      ).result.current,
    )

    expect(next.scope).not.toBe(initial.scope)
    expect(next.resources.index).not.toBe(initial.resources.index)
    expect(next.resources.loader).not.toBe(initial.resources.loader)
    expect(next.resources.structure).not.toBe(initial.resources.structure)
    expect(next.resources.structure).toEqual({
      status: 'unavailable',
      reason: 'unauthorized',
    })
    expect(next.resources.access).not.toBe(initial.resources.access)
    expect(next.resources.access.status).toBe('available')
    expect(next.content.notes).not.toBe(initial.content.notes)
    expect(next.content.files).not.toBe(initial.content.files)
    expect(next.content.maps).not.toBe(initial.content.maps)
    expect(next.content.canvases).not.toBe(initial.content.canvases)
    expect(next.preferences).not.toBe(initial.preferences)
  })
})

function requireRuntime(runtime: EditorRuntime | null): EditorRuntime {
  if (!runtime) throw new TypeError('Expected committed runtime')
  return runtime
}
