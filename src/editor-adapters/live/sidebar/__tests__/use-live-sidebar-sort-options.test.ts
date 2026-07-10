import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { WIZARD_EDITOR_DEFAULT_SORT_OPTIONS } from '@wizard-archive/editor/adapter'
import type { WizardEditorSortOptions } from '@wizard-archive/editor/adapter'
import type { LiveWorkspacePreferences } from '~/editor-adapters/live/live-workspace-preferences'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useLiveSidebarSortOptions } from '../use-live-sidebar-sort-options'

const SORT_ORDERS = {
  Alphabetical: 'Alphabetical',
  DateCreated: 'DateCreated',
  DateModified: 'DateModified',
} as const

const SORT_DIRECTIONS = {
  Ascending: 'Ascending',
  Descending: 'Descending',
} as const

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
  data: null as LiveWorkspacePreferences | null,
}))
const campaignIdState = vi.hoisted(() => ({
  value: 'campaign_1',
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
  useCampaign: () => ({
    campaignId: campaignIdState.value,
    dmUsername: 'dm',
    campaignSlug: 'world',
  }),
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
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

const alphabeticalAscending: WizardEditorSortOptions = {
  order: SORT_ORDERS.Alphabetical,
  direction: SORT_DIRECTIONS.Ascending,
}

const modifiedDescending: WizardEditorSortOptions = {
  order: SORT_ORDERS.DateModified,
  direction: SORT_DIRECTIONS.Descending,
}

const createdAscending: WizardEditorSortOptions = {
  order: SORT_ORDERS.DateCreated,
  direction: SORT_DIRECTIONS.Ascending,
}

describe('useLiveSidebarSortOptions', () => {
  beforeEach(() => {
    queryClient = createQueryClient()
    mutationCalls.length = 0
    handleErrorMock.mockReset()
    currentEditorState.data = null
    campaignIdState.value = 'campaign_1'
  })

  it('uses current editor data and writes optimistic sort updates to the query cache', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)

    const { result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    expect(result.current.options).toEqual({
      order: SORT_ORDERS.DateCreated,
      direction: SORT_DIRECTIONS.Descending,
    })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })

    expect(queryClient.getQueryData(['getCurrentEditor', 'campaign_1'])).toMatchObject({
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Ascending,
    })
    expect(result.current.options).toEqual(alphabeticalAscending)
  })

  it('keeps the latest pending sort when an older mutation fails', async () => {
    const { result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    await act(async () => {
      result.current.setOptions(modifiedDescending)
      await mutationCalls[1].context
    })

    expect(result.current.options).toEqual(modifiedDescending)

    await act(async () => {
      mutationCalls[0].options.onError?.(
        new Error('first failed'),
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })

    expect(result.current.options).toEqual(modifiedDescending)
    expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error), 'Failed to save sort options')
  })

  it('rolls the latest failed sort back to the previous pending sort', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)
    const { result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    await act(async () => {
      result.current.setOptions(modifiedDescending)
      await mutationCalls[1].context
    })

    await act(async () => {
      mutationCalls[1].options.onError?.(
        new Error('second failed'),
        mutationCalls[1].args,
        await mutationCalls[1].context,
      )
    })

    expect(result.current.options).toEqual(alphabeticalAscending)
    expect(queryClient.getQueryData(['getCurrentEditor', 'campaign_1'])).toMatchObject({
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Ascending,
    })
  })

  it('rolls back only sort fields when the latest sort fails', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)
    const { result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], {
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Ascending,
      editorMode: 'viewer',
    })

    await act(async () => {
      mutationCalls[0].options.onError?.(
        new Error('sort failed'),
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })

    expect(queryClient.getQueryData(['getCurrentEditor', 'campaign_1'])).toMatchObject({
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'viewer',
    })
  })

  it('uses the saved baseline when the latest failed sort rolls back', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)
    const { result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    await act(async () => {
      result.current.setOptions(modifiedDescending)
      await mutationCalls[1].context
    })

    await act(async () => {
      mutationCalls[0].options.onError?.(
        new Error('first failed'),
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
      mutationCalls[1].options.onError?.(
        new Error('second failed'),
        mutationCalls[1].args,
        await mutationCalls[1].context,
      )
    })

    expect(queryClient.getQueryData(['getCurrentEditor', 'campaign_1'])).toMatchObject({
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
    })
    expect(result.current.options).toEqual({
      order: SORT_ORDERS.DateCreated,
      direction: SORT_DIRECTIONS.Descending,
    })
  })

  it('rebases all pending rollbacks when the oldest pending sort fails', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)
    const { result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    await act(async () => {
      result.current.setOptions(modifiedDescending)
      await mutationCalls[1].context
    })
    await act(async () => {
      result.current.setOptions(createdAscending)
      await mutationCalls[2].context
    })

    await act(async () => {
      mutationCalls[0].options.onError?.(
        new Error('first failed'),
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })
    await act(async () => {
      mutationCalls[2].options.onError?.(
        new Error('third failed'),
        mutationCalls[2].args,
        await mutationCalls[2].context,
      )
    })
    await act(async () => {
      mutationCalls[1].options.onError?.(
        new Error('second failed'),
        mutationCalls[1].args,
        await mutationCalls[1].context,
      )
    })

    expect(result.current.options).toEqual({
      order: SORT_ORDERS.DateCreated,
      direction: SORT_DIRECTIONS.Descending,
    })
  })

  it('keeps a newer pending sort across an older successful invalidation', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)
    const invalidate = deferred<void>()
    vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(invalidate.promise)
    const { result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    await act(async () => {
      mutationCalls[0].options.onSettled?.(
        undefined,
        null,
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })
    await act(async () => {
      result.current.setOptions(modifiedDescending)
      await mutationCalls[1].context
    })

    await act(async () => {
      invalidate.resolve()
      await invalidate.promise
    })

    expect(result.current.options).toEqual(modifiedDescending)

    currentEditorState.data = {
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Ascending,
      editorMode: 'editor',
    }
    await act(async () => {
      mutationCalls[1].options.onError?.(
        new Error('second failed'),
        mutationCalls[1].args,
        await mutationCalls[1].context,
      )
    })

    expect(queryClient.getQueryData(['getCurrentEditor', 'campaign_1'])).toMatchObject({
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Ascending,
    })
    expect(result.current.options).toEqual(alphabeticalAscending)
  })

  it('uses the previous persisted sort while the editor row awaits refetch', async () => {
    const invalidate = deferred<void>()
    vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(invalidate.promise)
    const { result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    await act(async () => {
      mutationCalls[0].options.onSettled?.(
        undefined,
        null,
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })
    await act(async () => {
      result.current.setOptions(modifiedDescending)
      await mutationCalls[1].context
    })

    await act(async () => {
      invalidate.resolve()
      await invalidate.promise
    })
    await act(async () => {
      mutationCalls[1].options.onError?.(
        new Error('second failed'),
        mutationCalls[1].args,
        await mutationCalls[1].context,
      )
    })

    expect(result.current.options).toEqual(alphabeticalAscending)
  })

  it('uses an older successful sort as the rollback baseline for a newer failure', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)
    const { result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    await act(async () => {
      result.current.setOptions(modifiedDescending)
      await mutationCalls[1].context
    })

    await act(async () => {
      mutationCalls[0].options.onSettled?.(
        undefined,
        null,
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Ascending,
      editorMode: 'editor',
    }
    await act(async () => {
      mutationCalls[1].options.onError?.(
        new Error('second failed'),
        mutationCalls[1].args,
        await mutationCalls[1].context,
      )
    })

    expect(queryClient.getQueryData(['getCurrentEditor', 'campaign_1'])).toMatchObject({
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Ascending,
    })
    expect(result.current.options).toEqual(alphabeticalAscending)
  })

  it('keeps the settled sort after the latest mutation succeeds', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }

    const { result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
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

    expect(result.current.options).toEqual(alphabeticalAscending)
  })

  it('does not reuse fallback sort options across campaign changes', async () => {
    const { rerender, result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    await act(async () => {
      mutationCalls[0].options.onSettled?.(
        undefined,
        null,
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
      await Promise.resolve()
    })

    expect(result.current.options).toEqual(alphabeticalAscending)

    campaignIdState.value = 'campaign_2'
    rerender()

    expect(result.current.options).toEqual(WIZARD_EDITOR_DEFAULT_SORT_OPTIONS)
  })

  it('rolls back the originating campaign when a stale mutation fails after switching campaigns', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)
    const { rerender, result } = renderHook(() => useLiveSidebarSortOptions(), { wrapper })

    await act(async () => {
      result.current.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })

    expect(queryClient.getQueryData(['getCurrentEditor', 'campaign_1'])).toMatchObject({
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Ascending,
    })

    campaignIdState.value = 'campaign_2'
    currentEditorState.data = null
    rerender()

    await act(async () => {
      result.current.setOptions(modifiedDescending)
      await mutationCalls[1].context
    })

    await act(async () => {
      mutationCalls[0].options.onError?.(
        new Error('stale campaign failed'),
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })

    expect(queryClient.getQueryData(['getCurrentEditor', 'campaign_1'])).toMatchObject({
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
    })
    expect(result.current.options).toEqual(modifiedDescending)
  })
})

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
