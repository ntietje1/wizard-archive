import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { createCanvasRuntime } from '../../__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../canvas-runtime-context'
import {
  useCanvasDocumentServices,
  useCanvasDomRuntime,
  useCanvasInteractionServices,
  useCanvasPresenceServices,
} from '../canvas-runtime'

describe('CanvasRuntimeProvider', () => {
  it('throws from narrow runtime hooks outside the provider', () => {
    expect(() => renderHook(() => useCanvasDomRuntime())).toThrow(
      'useCanvasDomRuntime must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasDocumentServices())).toThrow(
      'useCanvasDocumentServices must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasInteractionServices())).toThrow(
      'useCanvasInteractionServices must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasPresenceServices())).toThrow(
      'useCanvasPresenceServices must be used within CanvasRuntimeProvider',
    )
  })

  it('exposes independent service slices through narrow hooks', () => {
    const runtime = createCanvasRuntime()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CanvasRuntimeProvider {...runtime}>{children}</CanvasRuntimeProvider>
    )

    expect(renderHook(() => useCanvasDomRuntime(), { wrapper }).result.current).toBe(
      runtime.domRuntime,
    )
    expect(renderHook(() => useCanvasDocumentServices(), { wrapper }).result.current).toBe(
      runtime.documentServices,
    )
    expect(renderHook(() => useCanvasInteractionServices(), { wrapper }).result.current).toBe(
      runtime.interactionServices,
    )
    expect(renderHook(() => useCanvasPresenceServices(), { wrapper }).result.current).toBe(
      runtime.presenceServices,
    )
  })
})
