import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ReactNode } from 'react'
import type { UserPreferences } from 'shared/user-preferences/types'
import { useThemePreference } from '../use-theme-preference'

const { useAppMutationMock } = vi.hoisted(() => ({ useAppMutationMock: vi.fn() }))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: (...args: Array<unknown>) => useAppMutationMock(...args),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({ data: undefined }),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: vi.fn(),
}))

type ThemeMutationContext = {
  previous: UserPreferences | undefined
  previousResolvedTheme: 'dark' | 'light'
}

type ThemeMutationCallbacks = {
  onMutate: (variables: { theme: 'light' }) => Promise<ThemeMutationContext | undefined>
  onError: (
    error: Error,
    variables: { theme: 'light' },
    context: ThemeMutationContext | undefined,
  ) => void
}

describe('useThemePreference', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark', 'light')
    useAppMutationMock.mockReset()
  })

  it('restores the DOM theme when the first preference save fails', async () => {
    let callbacks: ThemeMutationCallbacks | undefined
    useAppMutationMock.mockImplementation((_mutation, options: ThemeMutationCallbacks) => {
      callbacks = options
      return { mutate: vi.fn() }
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    document.documentElement.classList.add('dark')

    renderHook(() => useThemePreference(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })

    if (!callbacks) throw new Error('theme mutation callbacks were not captured')
    let context: ThemeMutationContext | undefined
    await act(async () => {
      context = await callbacks?.onMutate({ theme: 'light' })
    })
    expect(document.documentElement).toHaveClass('light')

    act(() => {
      callbacks?.onError(new Error('save failed'), { theme: 'light' }, context)
    })

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).not.toHaveClass('light')
  })
})
