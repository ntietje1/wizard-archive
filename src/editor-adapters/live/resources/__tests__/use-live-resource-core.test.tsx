import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testCampaignId } from '../../../../../shared/test/campaign-id'
import { testCampaignMemberId } from '../../../../../shared/test/campaign-member-id'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import { useLiveResourceCore } from '../use-live-resource-core'

const convex = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn() }))

vi.mock('@convex-dev/react-query', () => ({ useConvex: () => convex }))

const scope: ResourceProjectionScope = {
  campaignId: testCampaignId('resource-core'),
  actorId: testCampaignMemberId('resource-core'),
  projection: 'dm',
  schema: RESOURCE_INDEX_SCHEMA,
}

describe('useLiveResourceCore', () => {
  beforeEach(() => {
    convex.query.mockReset()
    convex.mutation.mockReset()
  })

  it('preserves every capability identity within one authoritative scope', () => {
    const { result, rerender } = renderHook(
      ({ currentScope }) => useLiveResourceCore(currentScope),
      { initialProps: { currentScope: scope } },
    )
    const initial = result.current

    rerender({ currentScope: { ...scope } })

    expect(result.current.index).toBe(initial.index)
    expect(result.current.loader).toBe(initial.loader)
    expect(result.current.structure).toBe(initial.structure)
    expect(result.current.content.notes).toBe(initial.content.notes)
    expect(result.current.content.files).toBe(initial.content.files)
    expect(result.current.content.maps).toBe(initial.content.maps)
    expect(result.current.content.canvases).toBe(initial.content.canvases)
  })

  it('replaces every scoped capability when the actor projection changes', () => {
    const { result, rerender } = renderHook(
      ({ currentScope }) => useLiveResourceCore(currentScope),
      { initialProps: { currentScope: scope } },
    )
    const initial = result.current

    rerender({
      currentScope: {
        ...scope,
        actorId: testCampaignMemberId('other-actor'),
        projection: 'player',
      },
    })

    expect(result.current.index).not.toBe(initial.index)
    expect(result.current.loader).not.toBe(initial.loader)
    expect(result.current.structure).not.toBe(initial.structure)
    expect(result.current.content.notes).not.toBe(initial.content.notes)
    expect(result.current.content.files).not.toBe(initial.content.files)
    expect(result.current.content.maps).not.toBe(initial.content.maps)
    expect(result.current.content.canvases).not.toBe(initial.content.canvases)
  })
})
