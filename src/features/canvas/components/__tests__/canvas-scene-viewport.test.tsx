import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CanvasSceneViewport } from '../canvas-scene-viewport'
import { createCanvasDomRuntime } from '../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../system/canvas-engine'

describe('CanvasSceneViewport', () => {
  let domRuntime: ReturnType<typeof createCanvasDomRuntime> | null = null
  let engine: ReturnType<typeof createCanvasEngine> | null = null

  afterEach(() => {
    engine?.destroy()
    domRuntime?.destroy()
    engine = null
    domRuntime = null
  })

  it('scales and pans the live canvas background from the viewport', async () => {
    domRuntime = createCanvasDomRuntime()
    engine = createCanvasEngine({ domRuntime })
    const zoom = 3
    const expectedGridSize = `${(36 * Math.sqrt(zoom)).toFixed(3)}px`

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
      engine?.setViewportLive({ x: 42, y: -18, zoom })
    })

    await waitFor(() => {
      expect(screen.getByTestId('canvas-background')).toHaveStyle({
        backgroundPosition: '42px -18px',
        backgroundSize: `${expectedGridSize} ${expectedGridSize}`,
      })
    })
  })
})
