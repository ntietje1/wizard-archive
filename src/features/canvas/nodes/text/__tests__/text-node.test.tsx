import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TextNode } from '../text-node'

const richTextNodeSpy = vi.hoisted(() => vi.fn())

vi.mock('../../shared/canvas-rich-text-node', () => ({
  CanvasRichTextNode: (props: unknown) => {
    richTextNodeSpy(props)
    return <div />
  },
}))

describe('TextNode', () => {
  it('uses the uniform small canvas node resize minimum', () => {
    richTextNodeSpy.mockReset()

    render(<TextNode id="text-1" data={{}} dragging={false} />)

    expect(richTextNodeSpy).toHaveBeenCalledWith(
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
