import { describe, expect, it } from 'vite-plus/test'
import { stepSpringPosition } from '../spring-position'

describe('stepSpringPosition', () => {
  it('converges smoothly and settles exactly on the remote cursor target', () => {
    const state = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    }
    const target = { x: 240, y: 160 }
    let settled = false

    for (let frame = 0; frame < 300 && !settled; frame += 1) {
      settled = stepSpringPosition(state, target, 1 / 60)
    }

    expect(settled).toBe(true)
    expect(state).toEqual({
      position: target,
      velocity: { x: 0, y: 0 },
    })
  })

  it('caps long frame gaps before integrating cursor motion', () => {
    const state = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    }

    stepSpringPosition(state, { x: 100, y: 0 }, 1)
    expect(state.position.x).toBe(96)
  })
})
