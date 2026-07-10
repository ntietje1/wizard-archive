import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { useRef } from 'react'
import { stepSpring } from '../spring-position'
import { useSpringPosition } from '../use-spring-position'

describe('useSpringPosition', () => {
  it('steps spring positions toward the target', () => {
    const state = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } }

    const settled = stepSpring(state, { x: 100, y: 50 }, 1 / 60)

    expect(settled).toBe(false)
    expect(state.pos.x).toBeGreaterThan(0)
    expect(state.pos.x).toBeLessThan(100)
    expect(state.pos.y).toBeGreaterThan(0)
    expect(state.pos.y).toBeLessThan(50)
  })

  it('settles positions and velocity inside the threshold', () => {
    const state = { pos: { x: 9.9, y: 20.1 }, vel: { x: 0.05, y: -0.05 } }

    const settled = stepSpring(state, { x: 10, y: 20 }, 0)

    expect(settled).toBe(true)
    expect(state).toEqual({ pos: { x: 10, y: 20 }, vel: { x: 0, y: 0 } })
  })

  it('clamps long frames to the maximum spring timestep', () => {
    const longFrameState = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } }
    const maxFrameState = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } }

    stepSpring(longFrameState, { x: 100, y: 0 }, 1)
    stepSpring(maxFrameState, { x: 100, y: 0 }, 0.04)

    expect(longFrameState).toEqual(maxFrameState)
  })

  it('clears the element transform when the target becomes inactive', () => {
    const { rerender } = render(<SpringPositionProbe target={{ x: 12, y: 34 }} />)
    const probe = screen.getByTestId('spring-position-probe')

    expect(probe.style.transform).toContain('12px')
    expect(probe.style.transform).toContain('34px')

    rerender(<SpringPositionProbe target={null} />)

    expect(probe.style.transform).toBe('')
  })
})

function SpringPositionProbe({ target }: { target: { x: number; y: number } | null }) {
  const elementRef = useRef<HTMLDivElement>(null)
  useSpringPosition(target, elementRef)
  return <div ref={elementRef} data-testid="spring-position-probe" />
}
