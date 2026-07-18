import { describe, expect, it } from 'vite-plus/test'
import { stepSpringPosition } from '../spring-position'

describe('stepSpringPosition', () => {
  it.each([1 / 60, 1 / 40, 1 / 30, 1 / 25])(
    'stays bounded and settles exactly at a %d second frame interval',
    (elapsed) => {
      const state = {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
      }
      const target = { x: 240, y: 160 }
      let settled = false

      for (let frame = 0; frame < 300 && !settled; frame += 1) {
        settled = stepSpringPosition(state, target, elapsed)
        expect(state.position.x).toBeGreaterThanOrEqual(0)
        expect(state.position.x).toBeLessThanOrEqual(target.x)
        expect(state.position.y).toBeGreaterThanOrEqual(0)
        expect(state.position.y).toBeLessThanOrEqual(target.y)
      }

      expect(settled).toBe(true)
      expect(state).toEqual({
        position: target,
        velocity: { x: 0, y: 0 },
      })
    },
  )

  it('is frame independent before settling', () => {
    const oneStep = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    }
    const twoSteps = structuredClone(oneStep)
    const target = { x: 100, y: 50 }

    stepSpringPosition(oneStep, target, 1 / 30)
    stepSpringPosition(twoSteps, target, 1 / 60)
    stepSpringPosition(twoSteps, target, 1 / 60)

    expect(twoSteps.position.x).toBeCloseTo(oneStep.position.x, 10)
    expect(twoSteps.position.y).toBeCloseTo(oneStep.position.y, 10)
    expect(twoSteps.velocity.x).toBeCloseTo(oneStep.velocity.x, 10)
    expect(twoSteps.velocity.y).toBeCloseTo(oneStep.velocity.y, 10)
  })

  it('converges safely after a long pause', () => {
    const state = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    }

    expect(stepSpringPosition(state, { x: 100, y: 0 }, 1)).toBe(true)
    expect(state).toEqual({
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
    })
  })

  it('remains bounded when the target changes during motion', () => {
    const state = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    }

    stepSpringPosition(state, { x: 100, y: 0 }, 1 / 30)
    const positionBeforeChange = state.position.x
    stepSpringPosition(state, { x: -100, y: 0 }, 1 / 30)

    expect(positionBeforeChange).toBeGreaterThan(0)
    expect(state.position.x).toBeGreaterThan(-100)
    expect(state.position.x).toBeLessThan(100)
    expect(Number.isFinite(state.velocity.x)).toBe(true)
  })
})
