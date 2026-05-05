import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { createCanvasRuntime } from '../../__tests__/canvas-runtime-test-utils'
import {
  CanvasRuntimeProvider,
  useCanvasCollaborationRuntime,
  useCanvasDocumentRuntime,
  useCanvasInteractionRuntime,
  useCanvasViewportRuntime,
} from '../canvas-runtime'

describe('CanvasRuntimeProvider', () => {
  it('throws from grouped runtime hooks outside the provider', () => {
    expect(() => renderHook(() => useCanvasDocumentRuntime())).toThrow(
      'useCanvasDocumentRuntime must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasInteractionRuntime())).toThrow(
      'useCanvasInteractionRuntime must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasViewportRuntime())).toThrow(
      'useCanvasViewportRuntime must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasCollaborationRuntime())).toThrow(
      'useCanvasCollaborationRuntime must be used within CanvasRuntimeProvider',
    )
  })

  it('exposes services grouped by runtime concern', () => {
    const runtime = createCanvasRuntime()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CanvasRuntimeProvider {...runtime}>{children}</CanvasRuntimeProvider>
    )

    expect(renderHook(() => useCanvasDocumentRuntime(), { wrapper }).result.current).toEqual({
      commands: runtime.commands,
      documentWriter: runtime.documentWriter,
      history: runtime.history,
    })
    expect(renderHook(() => useCanvasInteractionRuntime(), { wrapper }).result.current).toEqual({
      canEdit: runtime.canEdit,
      editSession: runtime.editSession,
      nodeActions: runtime.nodeActions,
      selection: runtime.selection,
    })
    expect(renderHook(() => useCanvasViewportRuntime(), { wrapper }).result.current).toEqual({
      domRuntime: runtime.domRuntime,
      viewportController: runtime.viewportController,
    })
    expect(renderHook(() => useCanvasCollaborationRuntime(), { wrapper }).result.current).toEqual({
      remoteHighlights: runtime.remoteHighlights,
    })
  })
})
