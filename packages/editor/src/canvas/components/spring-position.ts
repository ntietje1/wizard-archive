export type Vec2 = { x: number; y: number }

export type SpringOptions = {
  stiffness?: number
  damping?: number
  settleThreshold?: number
}

const SPRING_DEFAULTS = {
  stiffness: 600,
  damping: 50,
  settleThreshold: 0.3,
  maxDt: 0.04,
} as const

export type SpringState = { pos: Vec2; vel: Vec2 }

export function stepSpring(
  state: SpringState,
  target: Vec2,
  dt: number,
  opts?: SpringOptions,
): boolean {
  const stiffness = opts?.stiffness ?? SPRING_DEFAULTS.stiffness
  const damping = opts?.damping ?? SPRING_DEFAULTS.damping
  const settle = opts?.settleThreshold ?? SPRING_DEFAULTS.settleThreshold
  const frameDt = Math.min(dt, SPRING_DEFAULTS.maxDt)

  const { pos, vel } = state
  const dx = target.x - pos.x
  const dy = target.y - pos.y

  vel.x += (stiffness * dx - damping * vel.x) * frameDt
  vel.y += (stiffness * dy - damping * vel.y) * frameDt
  pos.x += vel.x * frameDt
  pos.y += vel.y * frameDt

  const postDx = target.x - pos.x
  const postDy = target.y - pos.y
  if (
    Math.abs(postDx) < settle &&
    Math.abs(postDy) < settle &&
    Math.abs(vel.x) < settle &&
    Math.abs(vel.y) < settle
  ) {
    pos.x = target.x
    pos.y = target.y
    vel.x = 0
    vel.y = 0
    return true
  }

  return false
}
