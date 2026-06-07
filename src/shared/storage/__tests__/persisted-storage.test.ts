import { beforeEach, describe, expect, it } from 'vitest'
import { parsePersistedJson, readPersistedJson } from '../persisted-storage'

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
})
