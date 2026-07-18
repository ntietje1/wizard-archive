export type SpringPosition = Readonly<{ x: number; y: number }>
export type MutableSpringState = {
  position: { x: number; y: number }
  velocity: { x: number; y: number }
}

const SETTLE_THRESHOLD = 0.3
// These are the exact roots of the reference spring x'' + 50x' + 600(x - target) = 0.
const SLOW_DECAY = -20
const FAST_DECAY = -30

export function stepSpringPosition(
  state: MutableSpringState,
  target: SpringPosition,
  elapsedSeconds: number,
): boolean {
  const elapsed = Math.max(elapsedSeconds, 0)
  const x = stepSpringAxis(state.position.x, state.velocity.x, target.x, elapsed)
  const y = stepSpringAxis(state.position.y, state.velocity.y, target.y, elapsed)
  state.position.x = x.position
  state.position.y = y.position
  state.velocity.x = x.velocity
  state.velocity.y = y.velocity

  const remainingX = target.x - state.position.x
  const remainingY = target.y - state.position.y
  if (
    Math.abs(remainingX) >= SETTLE_THRESHOLD ||
    Math.abs(remainingY) >= SETTLE_THRESHOLD ||
    Math.abs(state.velocity.x) >= SETTLE_THRESHOLD ||
    Math.abs(state.velocity.y) >= SETTLE_THRESHOLD
  ) {
    return false
  }
  state.position = { ...target }
  state.velocity = { x: 0, y: 0 }
  return true
}

function stepSpringAxis(position: number, velocity: number, target: number, elapsed: number) {
  const offset = position - target
  const slowCoefficient = (velocity - FAST_DECAY * offset) / (SLOW_DECAY - FAST_DECAY)
  const fastCoefficient = offset - slowCoefficient
  const slowElapsed = Math.exp(SLOW_DECAY * elapsed)
  const fastElapsed = Math.exp(FAST_DECAY * elapsed)
  return {
    position: target + slowCoefficient * slowElapsed + fastCoefficient * fastElapsed,
    velocity:
      SLOW_DECAY * slowCoefficient * slowElapsed + FAST_DECAY * fastCoefficient * fastElapsed,
  }
}
