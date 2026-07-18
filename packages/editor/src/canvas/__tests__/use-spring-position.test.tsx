import { render } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useSpringPosition } from '../use-spring-position'

describe('useSpringPosition', () => {
  it('replaces and cancels animation frames with the cursor lifetime', () => {
    let nextFrame = 0
    const requestFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => ++nextFrame)
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    try {
      const view = render(<SpringPositionProbe target={{ x: 0, y: 0 }} />)

      expect(requestFrame).toHaveBeenCalledOnce()
      view.rerender(<SpringPositionProbe target={{ x: 100, y: 50 }} />)
      expect(cancelFrame).toHaveBeenCalledWith(1)
      expect(requestFrame).toHaveBeenCalledTimes(2)

      view.unmount()
      expect(cancelFrame).toHaveBeenLastCalledWith(2)
    } finally {
      requestFrame.mockRestore()
      cancelFrame.mockRestore()
    }
  })
})

function SpringPositionProbe({ target }: { target: Readonly<{ x: number; y: number }> }) {
  const element = useRef<HTMLDivElement>(null)
  useSpringPosition(target, element)
  return <div ref={element} />
}
