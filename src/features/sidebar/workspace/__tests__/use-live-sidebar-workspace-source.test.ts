import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'shared/editor/types'
import type { Editor, SortOptions } from 'shared/editor/types'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import type {
  SidebarItemsContextValue,
  SidebarItemsValue,
} from '../../contexts/sidebar-items-context'
import { buildSidebarItemMaps } from '../../utils/sidebar-item-maps'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { useLiveSidebarWorkspaceSource } from '../use-live-sidebar-workspace-source'

interface MockMutationOptions {
  onMutate?: (args: unknown) => unknown
  onError?: (error: Error, args: unknown, context: unknown) => void
  onSettled?: (data: unknown, error: Error | null, args: unknown, context: unknown) => void
}

const liveSourceState = vi.hoisted(() => ({
  activeItems: [] as Array<AnySidebarItem>,
  trashItems: [] as Array<AnySidebarItem>,
  setFolderState: vi.fn(),
}))
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

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: () => ({ campaignActor: { kind: 'dm' } }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useSidebarItemsQueries: (): SidebarItemsContextValue => ({
    active: sidebarItemsValue(liveSourceState.activeItems),
    trash: sidebarItemsValue(liveSourceState.trashItems),
  }),
}))

vi.mock('~/features/sidebar/stores/sidebar-ui-store', () => ({
  useCampaignSidebarState: () => ({
    folderStates: {},
    closeAllFoldersMode: false,
    bookmarksOnlyMode: false,
  }),
  useCampaignSidebarActions: () => ({
    setFolderState: liveSourceState.setFolderState,
    toggleFolderState: vi.fn(),
    clearAllFolderStates: vi.fn(),
    toggleCloseAllFoldersMode: vi.fn(),
    exitCloseAllMode: vi.fn(),
    toggleBookmarksOnlyMode: vi.fn(),
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

const alphabeticalAscending: SortOptions = {
  order: SORT_ORDERS.Alphabetical,
  direction: SORT_DIRECTIONS.Ascending,
}

const modifiedDescending: SortOptions = {
  order: SORT_ORDERS.DateModified,
  direction: SORT_DIRECTIONS.Descending,
}

describe('useLiveSidebarWorkspaceSource', () => {
  beforeEach(() => {
    queryClient = createQueryClient()
    liveSourceState.activeItems = []
    liveSourceState.trashItems = []
    liveSourceState.setFolderState.mockReset()
    mutationCalls.length = 0
    handleErrorMock.mockReset()
    currentEditorState.data = null
  })

  it('opens every active ancestor folder for an item through source UI commands', () => {
    const rootFolder = createFolder()
    const childFolder = createFolder({ parentId: rootFolder._id })
    const nestedNote = createNote({ parentId: childFolder._id })
    liveSourceState.activeItems = [rootFolder, childFolder, nestedNote]

    const { result } = renderHook(() => useLiveSidebarWorkspaceSource(), { wrapper })

    result.current.commands.openParentFolders(nestedNote._id)

    expect(liveSourceState.setFolderState).toHaveBeenCalledTimes(2)
    expect(liveSourceState.setFolderState).toHaveBeenNthCalledWith(1, childFolder._id, true)
    expect(liveSourceState.setFolderState).toHaveBeenNthCalledWith(2, rootFolder._id, true)
  })

  it('uses current editor data and writes optimistic sort updates to the query cache', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)

    const { result } = renderHook(() => useLiveSidebarWorkspaceSource(), { wrapper })

    expect(result.current.sort.options).toEqual({
      order: SORT_ORDERS.DateCreated,
      direction: SORT_DIRECTIONS.Descending,
    })

    await act(async () => {
      result.current.sort.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })

    expect(queryClient.getQueryData(['getCurrentEditor', 'campaign_1'])).toMatchObject({
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Ascending,
    })
    expect(result.current.sort.options).toEqual(alphabeticalAscending)
  })

  it('keeps the latest pending sort when an older mutation fails', async () => {
    const { result } = renderHook(() => useLiveSidebarWorkspaceSource(), { wrapper })

    await act(async () => {
      result.current.sort.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    await act(async () => {
      result.current.sort.setOptions(modifiedDescending)
      await mutationCalls[1].context
    })

    expect(result.current.sort.options).toEqual(modifiedDescending)

    await act(async () => {
      mutationCalls[0].options.onError?.(
        new Error('first failed'),
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })

    expect(result.current.sort.options).toEqual(modifiedDescending)
    expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error), 'Failed to save sort options')
  })

  it('rolls the latest failed sort back to the saved baseline instead of an older optimistic value', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)
    const { result } = renderHook(() => useLiveSidebarWorkspaceSource(), { wrapper })

    await act(async () => {
      result.current.sort.setOptions(alphabeticalAscending)
      await mutationCalls[0].context
    })
    await act(async () => {
      result.current.sort.setOptions(modifiedDescending)
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
    expect(result.current.sort.options).toEqual({
      order: SORT_ORDERS.DateCreated,
      direction: SORT_DIRECTIONS.Descending,
    })
  })

  it('does not let an older successful invalidation clear a newer pending sort', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }
    queryClient.setQueryData(['getCurrentEditor', 'campaign_1'], currentEditorState.data)
    const invalidate = deferred<void>()
    vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(invalidate.promise)
    const { result } = renderHook(() => useLiveSidebarWorkspaceSource(), { wrapper })

    await act(async () => {
      result.current.sort.setOptions(alphabeticalAscending)
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
      result.current.sort.setOptions(modifiedDescending)
      await mutationCalls[1].context
    })

    await act(async () => {
      invalidate.resolve()
      await invalidate.promise
    })

    expect(result.current.sort.options).toEqual(modifiedDescending)

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
    expect(result.current.sort.options).toEqual(alphabeticalAscending)
  })

  it('rolls back to the previous persisted sort when the editor row has not refetched yet', async () => {
    const invalidate = deferred<void>()
    vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(invalidate.promise)
    const { result } = renderHook(() => useLiveSidebarWorkspaceSource(), { wrapper })

    await act(async () => {
      result.current.sort.setOptions(alphabeticalAscending)
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
      result.current.sort.setOptions(modifiedDescending)
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

    expect(result.current.sort.options).toEqual(alphabeticalAscending)
  })

  it('clears pending sort after the latest mutation settles successfully', async () => {
    currentEditorState.data = {
      sortOrder: SORT_ORDERS.DateCreated,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: 'editor',
    }

    const { result } = renderHook(() => useLiveSidebarWorkspaceSource(), { wrapper })

    await act(async () => {
      result.current.sort.setOptions(alphabeticalAscending)
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

    expect(result.current.sort.options).toEqual(alphabeticalAscending)
    expect(handleErrorMock).not.toHaveBeenCalled()
  })
})

function sidebarItemsValue(data: Array<AnySidebarItem>): SidebarItemsValue {
  return {
    data,
    status: 'success',
    error: null,
    refetch: vi.fn(),
    ...buildSidebarItemMaps(data),
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
