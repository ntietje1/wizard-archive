import { afterEach, describe, expect, it } from 'vitest'
import { useSearchStore } from '~/features/search/stores/search-store'

describe('useSearchStore', () => {
  afterEach(() => {
    useSearchStore.setState({ isOpen: false, query: '', showPreview: true })
  })

  it('has correct initial state', () => {
    const state = useSearchStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.query).toBe('')
    expect(state.showPreview).toBe(true)
  })

  it('opens the dialog', () => {
    useSearchStore.getState().open()
    expect(useSearchStore.getState().isOpen).toBe(true)
  })

  it('closes the dialog and clears query', () => {
    useSearchStore.getState().open()
    useSearchStore.getState().setQuery('hello')
    useSearchStore.getState().close()

    const state = useSearchStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.query).toBe('')
  })

  it('sets query', () => {
    useSearchStore.getState().setQuery('dragon')
    expect(useSearchStore.getState().query).toBe('dragon')
  })

  it('toggles preview', () => {
    expect(useSearchStore.getState().showPreview).toBe(true)
    useSearchStore.getState().togglePreview()
    expect(useSearchStore.getState().showPreview).toBe(false)
    useSearchStore.getState().togglePreview()
    expect(useSearchStore.getState().showPreview).toBe(true)
  })

  it('close is idempotent when already closed', () => {
    useSearchStore.getState().close()
    const state = useSearchStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.query).toBe('')
  })

  it('open is idempotent when already open', () => {
    useSearchStore.getState().open()
    useSearchStore.getState().open()
    expect(useSearchStore.getState().isOpen).toBe(true)
  })

  it('only persists showPreview', () => {
    const store = useSearchStore
    const partialize = (
      store as unknown as {
        persist: {
          getOptions: () => {
            partialize: (state: Record<string, unknown>) => Record<string, unknown>
          }
        }
      }
    ).persist.getOptions().partialize

    const full = { isOpen: true, query: 'test', showPreview: false }
    const persisted = partialize(full)

    expect(persisted).toEqual({ showPreview: false })
    expect(persisted).not.toHaveProperty('isOpen')
    expect(persisted).not.toHaveProperty('query')
  })
})
