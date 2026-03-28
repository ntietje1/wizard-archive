import { vi } from 'vitest'

export function createMockNavigate() {
  return vi.fn()
}

export function createMockParams(params: Record<string, string> = {}) {
  return params
}

export function createMockSearch(search: Record<string, unknown> = {}) {
  return search
}

export function createMockLocation(overrides: Record<string, string> = {}) {
  return {
    pathname: '/',
    search: '',
    hash: '',
    ...overrides,
  }
}
