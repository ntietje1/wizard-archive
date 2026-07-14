import { renderHook } from '@testing-library/react'
import { useDndStoreApi } from '../store'

export const defaultDndStoreApi = renderHook(() => useDndStoreApi()).result.current

export function resetDndStore() {
  defaultDndStoreApi.setState(defaultDndStoreApi.getInitialState(), true)
}
