import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { TextNode } from '../text-node'

const canvasTextNodeSpy = vi.hoisted(() => vi.fn())

vi.mock('../../shared/canvas-text-node', () => ({
  CanvasTextNode: (props: unknown) => {
    canvasTextNodeSpy(props)
    return <div />
  },
}))

describe('TextNode', () => {
  it('uses the uniform small canvas node resize minimum', () => {
    canvasTextNodeSpy.mockReset()

    render(<TextNode id="text-1" data={{}} dragging={false} />)

    expect(canvasTextNodeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: expect.objectContaining({
          minHeight: 10,
          minWidth: 10,
          nodeType: 'text',
        }),
      }),
    )
  })
})
