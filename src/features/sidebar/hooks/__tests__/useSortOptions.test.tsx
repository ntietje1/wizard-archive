import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'shared/editor/types'
import { SidebarSortOptionsProvider, useSortOptions } from '~/features/sidebar/hooks/useSortOptions'
import type { ReactNode } from 'react'
import type { Editor, SortOptions } from 'shared/editor/types'

interface MockMutationOptions {
  onMutate?: (args: unknown) => unknown
  onError?: (error: Error, args: unknown, context: unknown) => void
  onSettled?: (data: unknown, error: Error | null, args: unknown, context: unknown) => void
}

const mutationCalls = vi.hoisted(
  () =>
    [] as Array<{
      args: { sortOrder: string; sortDirection: string }
      context: Promise<unknown>
      options: MockMutationOptions
    }>,
)
const handleErrorMock = vi.hoisted(() => vi.fn())
const currentEditorState = vi.hoisted(() => ({
  data: null as Editor | null,
}))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (_query: unknown, args: { campaignId: string }) => ({
    queryKey: ['getCurrentEditor', args.campaignId],
  }),
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    editors: {
      queries: { getCurrentEditor: 'getCurrentEditor' },
      mutations: { setCurrentEditor: 'setCurrentEditor' },
    },
  },
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' }),
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: () => ({ data: currentEditorState.data, status: 'success' }),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: (_mutation: unknown, options: MockMutationOptions) => ({
    mutate: (args: { sortOrder: string; sortDirection: string }) => {
      mutationCalls.push({
        args,
        context: Promise.resolve(options.onMutate?.(args)),
        options,
      })
    },
  }),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: (...args: Array<unknown>) => handleErrorMock(...args),
}))

let queryClient: QueryClient

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarSortOptionsProvider>{children}</SidebarSortOptionsProvider>
    </QueryClientProvider>
  )
}

const alphabeticalAscending: SortOptions = {
  order: SORT_ORDERS.Alphabetical,
  direction: SORT_DIRECTIONS.Ascending,
}

const modifiedDescending: SortOptions = {
  order: SORT_ORDERS.DateModified,
  direction: SORT_DIRECTIONS.Descending,
}

describe('useSortOptions', () => {
  beforeEach(() => {
    queryClient = createQueryClient()
    mutationCalls.length = 0
    handleErrorMock.mockReset()
    currentEditorState.data = null
  })

  it('uses existing editor data and writes optimistic sort updates to the query cache', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)

    const { result } = renderHook(() => useSortOptions(), { wrapper })

    expect(result.current.sortOptions).toEqual({
      order: SORT_ORDERS.DateCreated,
      direction: SORT_DIRECTIONS.Descending,
    })

    await act(async () => {
      result.current.setSortOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })

    expect(queryClient.getQueryData(['getCurrentEditor', 'campaign_1'])).toMatchObject({
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Ascending,
    })
    expect(result.current.sortOptions).toEqual(alphabeticalAscending)
  })

  it('keeps the latest pending sort when an older mutation fails', async () => {
    const { result } = renderHook(() => useSortOptions(), { wrapper })

    await act(async () => {
      result.current.setSortOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    await act(async () => {
      result.current.setSortOptions(modifiedDescending)
      await mutationCalls[1].context
    })

    expect(result.current.sortOptions).toEqual(modifiedDescending)

    await act(async () => {
      mutationCalls[0].options.onError?.(
        new Error('first failed'),
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })

    expect(result.current.sortOptions).toEqual(modifiedDescending)
    expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error), 'Failed to save sort options')
  })

  it('clears pending sort after the latest mutation settles successfully', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }

    const { result } = renderHook(() => useSortOptions(), { wrapper })

    await act(async () => {
      result.current.setSortOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })

    currentEditorState.data = {
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Ascending,
      editorMode: 'editor',
    }

    await act(async () => {
      mutationCalls[0].options.onSettled?.(
        undefined,
        null,
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })

    expect(result.current.sortOptions).toEqual(alphabeticalAscending)
    expect(handleErrorMock).not.toHaveBeenCalled()
  })
})
