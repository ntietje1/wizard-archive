import { act, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { CanvasEngineContext } from '../../../react/canvas-engine-context-value'
import { createCanvasEngine } from '../../../system/canvas-engine'
import {
  useCanvasEdgePendingPreview,
  useCanvasNodePendingPreview,
  useCanvasPendingPreviewActive,
} from '../use-canvas-pending-selection-preview'

describe('useCanvasPendingSelectionPreview', () => {
  it('exposes semantic selector hooks from the engine selection preview', () => {
    const engine = createCanvasEngine()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(CanvasEngineContext.Provider, { value: engine }, children)
    const { result } = renderHook(
      () => ({
        active: useCanvasPendingPreviewActive(),
        nodeSelected: useCanvasNodePendingPreview('node-1'),
        edgeSelected: useCanvasEdgePendingPreview('edge-1'),
      }),
      { wrapper },
    )

    expect(result.current).toEqual({
      active: false,
      nodeSelected: false,
      edgeSelected: false,
    })

    act(() => {
      engine.setSelectionGesturePreview({
        nodeIds: new Set(['node-1']),
        edgeIds: new Set(['edge-1']),
      })
    })

    expect(result.current).toEqual({
      active: true,
      nodeSelected: true,
      edgeSelected: true,
    })
  })
})
