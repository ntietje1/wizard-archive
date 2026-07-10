import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { CanvasRenderModeContext } from '../canvas-render-mode-context'
import { useIsInteractiveCanvasRenderMode } from '../use-canvas-render-mode'
import type { PropsWithChildren } from 'react'

describe('useIsInteractiveCanvasRenderMode', () => {
  it('treats a missing render mode provider as embedded readonly', () => {
    const { result } = renderHook(() => useIsInteractiveCanvasRenderMode())

    expect(result.current).toBe(false)
  })

  it('reports an explicit interactive render mode as interactive', () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <CanvasRenderModeContext.Provider value="interactive">
        {children}
      </CanvasRenderModeContext.Provider>
    )

    const { result } = renderHook(() => useIsInteractiveCanvasRenderMode(), { wrapper })

    expect(result.current).toBe(true)
  })
})
