export type SpringPosition = Readonly<{ x: number; y: number }>
export type MutableSpringState = {
  position: { x: number; y: number }
  velocity: { x: number; y: number }
}

const STIFFNESS = 600
const DAMPING = 50
const SETTLE_THRESHOLD = 0.3
const MAX_DELTA_SECONDS = 0.04

export function stepSpringPosition(
  state: MutableSpringState,
  target: SpringPosition,
  elapsedSeconds: number,
): boolean {
  const elapsed = Math.min(elapsedSeconds, MAX_DELTA_SECONDS)
  const deltaX = target.x - state.position.x
  const deltaY = target.y - state.position.y
  state.velocity.x += (STIFFNESS * deltaX - DAMPING * state.velocity.x) * elapsed
  state.velocity.y += (STIFFNESS * deltaY - DAMPING * state.velocity.y) * elapsed
  state.position.x += state.velocity.x * elapsed
  state.position.y += state.velocity.y * elapsed

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
