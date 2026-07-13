import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useResourceHydrationCache } from '../resource-hydration-cache'

describe('useResourceHydrationCache', () => {
  it('dedupes in-flight and successful loads for the same source/key', async () => {
    const load = vi.fn((key: string) => Promise.resolve(`loaded:${key}`))
    const { result } = renderHook(() => useResourceHydrationCache({ load }))

    act(() => {
      result.current.ensure({ key: 'alpha', sourceId: 'source-1' })
      result.current.ensure({ key: 'alpha', sourceId: 'source-1' })
    })

    expect(load).toHaveBeenCalledExactlyOnceWith('alpha')
    expect(result.current.getEntry({ key: 'alpha', sourceId: 'source-1' })).toMatchObject({
      status: 'loading',
      key: 'alpha',
      sourceId: 'source-1',
    })

    await act(async () => {})

    expect(result.current.getEntry({ key: 'alpha', sourceId: 'source-1' })).toEqual({
      status: 'success',
      key: 'alpha',
      sourceId: 'source-1',
      value: 'loaded:alpha',
    })

    act(() => {
      result.current.ensure({ key: 'alpha', sourceId: 'source-1' })
    })

    expect(load).toHaveBeenCalledOnce()
  })

  it('retries errors for the same source/key', async () => {
    const secondLoad = deferred<string>()
    const loadError = new Error('load failed')
    const load = vi
      .fn<(key: string) => Promise<string>>()
      .mockRejectedValueOnce(loadError)
      .mockReturnValueOnce(secondLoad.promise)
    const { result } = renderHook(() => useResourceHydrationCache({ load }))

    act(() => {
      result.current.ensure({ key: 'alpha', sourceId: 'source-1' })
    })

    await act(async () => {})
    expect(result.current.getEntry({ key: 'alpha', sourceId: 'source-1' })).toEqual({
      status: 'error',
      key: 'alpha',
      sourceId: 'source-1',
      error: loadError,
    })

    act(() => {
      result.current.ensure({ key: 'alpha', sourceId: 'source-1' })
    })
    secondLoad.resolve('fresh')
    await act(async () => {
      await secondLoad.promise
    })

    expect(result.current.getEntry({ key: 'alpha', sourceId: 'source-1' })).toEqual({
      status: 'success',
      key: 'alpha',
      sourceId: 'source-1',
      value: 'fresh',
    })
  })

  it('keeps separator-containing source and resource keys distinct', () => {
    const load = vi.fn((_key: string) => new Promise<string>(() => undefined))
    const { result } = renderHook(() => useResourceHydrationCache({ load }))

    act(() => {
      result.current.ensure({ sourceId: 'source:a', key: 'b' })
      result.current.ensure({ sourceId: 'source', key: 'a:b' })
    })

    expect(load).toHaveBeenCalledTimes(2)
    expect(result.current.getEntry({ sourceId: 'source:a', key: 'b' })).toMatchObject({
      sourceId: 'source:a',
      key: 'b',
    })
    expect(result.current.getEntry({ sourceId: 'source', key: 'a:b' })).toMatchObject({
      sourceId: 'source',
      key: 'a:b',
    })
  })
})

function deferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return { key: '' as string, promise, resolve: resolvePromise }
}
