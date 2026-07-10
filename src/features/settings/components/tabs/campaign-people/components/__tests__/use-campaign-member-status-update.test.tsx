import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import { useCampaignMemberStatusUpdate } from '../use-campaign-member-status-update'

const { mutateAsyncMock } = vi.hoisted(() => ({ mutateAsyncMock: vi.fn() }))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => ({ mutateAsync: mutateAsyncMock }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

describe('useCampaignMemberStatusUpdate', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset()
  })

  it('tracks concurrent member updates independently', async () => {
    const firstSave = deferred<void>()
    const secondSave = deferred<void>()
    mutateAsyncMock
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise)
    const firstMemberId = 'member-1' as Id<'campaignMembers'>
    const secondMemberId = 'member-2' as Id<'campaignMembers'>
    const { result } = renderHook(() =>
      useCampaignMemberStatusUpdate('campaign-1' as Id<'campaigns'>),
    )
    let firstUpdate!: Promise<void>
    let secondUpdate!: Promise<void>

    act(() => {
      firstUpdate = result.current.updateMemberStatus(
        firstMemberId,
        CAMPAIGN_MEMBER_STATUS.Accepted,
      )
      secondUpdate = result.current.updateMemberStatus(
        secondMemberId,
        CAMPAIGN_MEMBER_STATUS.Rejected,
      )
    })

    expect(result.current.isMemberStatusPending(firstMemberId)).toBe(true)
    expect(result.current.isMemberStatusPending(secondMemberId)).toBe(true)

    await act(async () => {
      firstSave.resolve()
      await firstUpdate
    })

    expect(result.current.isMemberStatusPending(firstMemberId)).toBe(false)
    expect(result.current.isMemberStatusPending(secondMemberId)).toBe(true)

    await act(async () => {
      secondSave.resolve()
      await secondUpdate
    })

    expect(result.current.isMemberStatusPending(secondMemberId)).toBe(false)
  })
})

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
