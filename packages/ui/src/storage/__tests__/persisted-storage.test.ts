import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  parsePersistedJson,
  readPersistedJson,
  subscribeToPersistedStorage,
  writePersistedJson,
} from '../persisted-storage'

function parseBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

describe('persisted-storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('falls back when stored JSON does not pass the parser', () => {
    window.localStorage.setItem('flag', '"bad"')

    expect(readPersistedJson('flag', false, parseBoolean)).toBe(false)
  })

  it('parses raw storage values through the shared validation path', () => {
    expect(parsePersistedJson('true', false, parseBoolean)).toBe(true)
    expect(parsePersistedJson('"bad"', false, parseBoolean)).toBe(false)
  })

  it('handles failed writes without dispatching a storage notification', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToPersistedStorage('flag', onChange)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    writePersistedJson('flag', true)

    expect(onChange).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('flag')).toBeNull()

    setItem.mockRestore()
    unsubscribe()
  })

  it('can ignore notifications from the same writer while notifying other subscribers', () => {
    const source = Symbol('writer')
    const sameWriter = vi.fn()
    const otherWriter = vi.fn()
    const unsubscribeSame = subscribeToPersistedStorage('flag', sameWriter, {
      ignoreSource: source,
    })
    const unsubscribeOther = subscribeToPersistedStorage('flag', otherWriter)

    writePersistedJson('flag', true, { source })

    expect(sameWriter).not.toHaveBeenCalled()
    expect(otherWriter).toHaveBeenCalledWith('true')

    unsubscribeSame()
    unsubscribeOther()
  })
})
