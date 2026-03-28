import { vi } from 'vitest'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'

// Single cast point for partial query mocks — unavoidable since tests
// consume a subset of UseQueryResult fields as the full type.
function asQueryResult<T>(
  base: Partial<UseQueryResult<T>>,
  overrides?: Partial<UseQueryResult<T>>,
): UseQueryResult<T> {
  return { ...base, ...overrides } as UseQueryResult<T>
}

function asMutationResult<TData, TArgs>(
  base: Partial<UseMutationResult<TData, Error, TArgs>>,
  overrides?: Partial<UseMutationResult<TData, Error, TArgs>>,
): UseMutationResult<TData, Error, TArgs> {
  return { ...base, ...overrides } as UseMutationResult<TData, Error, TArgs>
}

export function mockAuthQuery<T>(
  data: T | undefined,
  overrides?: Partial<UseQueryResult<T>>,
): UseQueryResult<T> {
  if (data === undefined) {
    return asQueryResult<T>(
      {
        data: undefined,
        status: 'pending',
        isPending: true,
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
        isFetching: true,
        fetchStatus: 'fetching',
        refetch: vi.fn(),
      },
      overrides,
    )
  }

  return asQueryResult<T>(
    {
      data,
      status: 'success',
      isPending: false,
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      isFetching: false,
      fetchStatus: 'idle',
      refetch: vi.fn(),
    },
    overrides,
  )
}

export function mockAuthQueryError<T>(error: Error): UseQueryResult<T> {
  return mockAuthQuery<T>(undefined, {
    status: 'error',
    isPending: false,
    isLoading: false,
    isError: true,
    error,
    isFetching: false,
    fetchStatus: 'idle',
  })
}

export function mockAppMutation<TData = unknown, TArgs = unknown>(
  overrides?: Partial<UseMutationResult<TData, Error, TArgs>>,
): UseMutationResult<TData, Error, TArgs> {
  return asMutationResult<TData, TArgs>(
    {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      data: undefined,
      error: null,
      variables: undefined,
      context: undefined,
      status: 'idle',
      isPending: false,
      isIdle: true,
      isSuccess: false,
      isError: false,
      failureCount: 0,
      failureReason: null,
      submittedAt: 0,
      reset: vi.fn(),
    },
    overrides,
  )
}
