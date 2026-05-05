import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { createCanvasRuntime } from '../../__tests__/canvas-runtime-test-utils'
import {
  CanvasRuntimeProvider,
  useCanvasCanEdit,
  useCanvasCommands,
  useCanvasDocumentWriter,
  useCanvasDomRuntime,
  useCanvasEditSession,
  useCanvasHistory,
  useCanvasNodeActions,
  useCanvasRemoteHighlights,
  useCanvasSelection,
  useCanvasViewportController,
} from '../canvas-runtime'

describe('CanvasRuntimeProvider', () => {
  it('throws from narrow runtime hooks outside the provider', () => {
    expect(() => renderHook(() => useCanvasDomRuntime())).toThrow(
      'useCanvasDomRuntime must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasDocumentWriter())).toThrow(
      'useCanvasDocumentWriter must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasViewportController())).toThrow(
      'useCanvasViewportController must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasRemoteHighlights())).toThrow(
      'useCanvasRemoteHighlights must be used within CanvasRuntimeProvider',
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
    expect(renderHook(() => useCanvasDocumentWriter(), { wrapper }).result.current).toBe(
      runtime.documentWriter,
    )
    expect(renderHook(() => useCanvasHistory(), { wrapper }).result.current).toBe(runtime.history)
    expect(renderHook(() => useCanvasCommands(), { wrapper }).result.current).toBe(runtime.commands)
    expect(renderHook(() => useCanvasNodeActions(), { wrapper }).result.current).toBe(
      runtime.nodeActions,
    )
    expect(renderHook(() => useCanvasCanEdit(), { wrapper }).result.current).toBe(runtime.canEdit)
    expect(renderHook(() => useCanvasEditSession(), { wrapper }).result.current).toBe(
      runtime.editSession,
    )
    expect(renderHook(() => useCanvasSelection(), { wrapper }).result.current).toBe(
      runtime.selection,
    )
    expect(renderHook(() => useCanvasViewportController(), { wrapper }).result.current).toBe(
      runtime.viewportController,
    )
    expect(renderHook(() => useCanvasRemoteHighlights(), { wrapper }).result.current).toBe(
      runtime.remoteHighlights,
    )
  })
})
