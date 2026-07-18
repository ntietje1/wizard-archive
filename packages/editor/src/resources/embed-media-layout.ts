export const AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK = 40

export type EmbedMediaLayout =
  | Readonly<{ kind: 'intrinsicAspectRatio'; aspectRatio: number | null }>
  | Readonly<{ kind: 'fixedHeight'; height: number }>

export type EmbedMediaLayoutReporter = (layout: EmbedMediaLayout) => void

export function intrinsicMediaAspectRatio(width: number, height: number): number | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return Number((width / height).toFixed(6))
}

export function mediaLayoutAspectRatio(layout: EmbedMediaLayout | null): number | null {
  if (
    layout?.kind !== 'intrinsicAspectRatio' ||
    layout.aspectRatio === null ||
    !Number.isFinite(layout.aspectRatio) ||
    layout.aspectRatio <= 0
  ) {
    return null
  }
  return layout.aspectRatio
}

export function mediaLayoutsEqual(
  current: EmbedMediaLayout | null,
  next: EmbedMediaLayout,
): boolean {
  if (current?.kind !== next.kind) return false
  if (current.kind === 'fixedHeight' && next.kind === 'fixedHeight') {
    return current.height === next.height
  }
  return (
    current.kind === 'intrinsicAspectRatio' &&
    next.kind === 'intrinsicAspectRatio' &&
    current.aspectRatio === next.aspectRatio
  )
}
