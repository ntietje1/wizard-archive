import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import usePersistedState from '../use-persisted-state'

function parseBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

describe('usePersistedState', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('uses the parser for subscription updates', () => {
    window.localStorage.setItem('flag', 'true')

    const { result } = renderHook(() => usePersistedState('flag', false, parseBoolean))

    expect(result.current[0]).toBe(true)

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'flag', newValue: '"bad"' }))
    })

    expect(result.current[0]).toBe(false)
  })

  it('falls back when subscription JSON is malformed', () => {
    const { result } = renderHook(() => usePersistedState('flag', false, parseBoolean))

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'flag', newValue: '{' }))
    })

    expect(result.current[0]).toBe(false)
  })

  it('persists setter updates without reprocessing its own storage notification', () => {
    const parse = vi.fn(parseBoolean)
    const { result } = renderHook(() => usePersistedState('flag', false, parse))

    act(() => {
      result.current[1]((current) => !current)
    })

    expect(result.current[0]).toBe(true)
    expect(window.localStorage.getItem('flag')).toBe('true')
    expect(parse).not.toHaveBeenCalled()
  })
})
