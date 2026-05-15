import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CanvasSceneViewport } from '../canvas-scene-viewport'
import { createCanvasDomRuntime } from '../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../system/canvas-engine'

describe('CanvasSceneViewport', () => {
  it('scales and pans the live canvas background from the viewport', async () => {
    const domRuntime = createCanvasDomRuntime()
    const engine = createCanvasEngine({ domRuntime })

    render(
      <CanvasSceneViewport
        engine={engine}
        domRuntime={domRuntime}
        surfaceRef={{ current: null }}
        viewportRef={{ current: null }}
        testId="canvas-scene"
        backgroundTestId="canvas-background"
      >
        <div />
      </CanvasSceneViewport>,
    )

    act(() => {
      engine.setViewportLive({ x: 42, y: -18, zoom: 3 })
    })

    await waitFor(() => {
      expect(screen.getByTestId('canvas-background')).toHaveStyle({
        backgroundPosition: '42px -18px',
        backgroundSize: '62.354px 62.354px',
      })
    })

    engine.destroy()
    domRuntime.destroy()
  })
})
