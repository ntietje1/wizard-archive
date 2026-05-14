import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { useSidebarItemById } from '../useSidebarItemById'

const useCampaignQueryMock = vi.hoisted(() => vi.fn())

vi.mock('convex/_generated/api', () => ({
  api: { sidebarItems: { queries: { getSidebarItem: 'getSidebarItem' } } },
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

describe('useSidebarItemById', () => {
  beforeEach(() => {
    useCampaignQueryMock.mockReset()
  })

  it('skips backend queries for optimistic ids', () => {
    useCampaignQueryMock.mockReturnValue({ data: null, isLoading: false, error: null })

    const { result } = renderHook(() =>
      useSidebarItemById('optimistic-create-1' as Id<'sidebarItems'>),
    )

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getSidebarItem', 'skip')
    expect(result.current).toEqual({ data: null, isLoading: false, error: null })
  })

  it('queries persisted item ids', () => {
    const item = createNote({ _id: 'note_1' as Id<'sidebarItems'> })
    useCampaignQueryMock.mockReturnValue({ data: item, isLoading: false, error: null })

    const { result } = renderHook(() => useSidebarItemById(item._id))

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getSidebarItem', { id: item._id })
    expect(result.current.data).toBe(item)
  })

  it('skips backend queries for undefined ids', () => {
    useCampaignQueryMock.mockReturnValue({ data: null, isLoading: false, error: null })

    const { result } = renderHook(() => useSidebarItemById(undefined))

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getSidebarItem', 'skip')
    expect(result.current.data).toBeNull()
  })

  it('skips backend queries for null ids', () => {
    useCampaignQueryMock.mockReturnValue({ data: null, isLoading: false, error: null })

    const { result } = renderHook(() => useSidebarItemById(null))

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getSidebarItem', 'skip')
    expect(result.current.data).toBeNull()
  })

  it('passes through loading and error state', () => {
    const error = new Error('failed')
    useCampaignQueryMock.mockReturnValue({ data: null, isLoading: true, error })

    const { result } = renderHook(() => useSidebarItemById('note_1' as Id<'sidebarItems'>))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBe(error)
  })
})
