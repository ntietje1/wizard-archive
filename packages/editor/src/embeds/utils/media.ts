export type EmbedMediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'unknown'
export const AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK = 40

export type EmbedMediaLayout =
  | { kind: 'intrinsicAspectRatio'; aspectRatio: number | null }
  | { kind: 'fixedHeight'; height: number }

export type EmbedMediaLayoutReporter = (layout: EmbedMediaLayout) => void

export function inferEmbedMediaKindFromContentType(
  contentType: string | null | undefined,
): EmbedMediaKind {
  if (!contentType) return 'unknown'

  const normalized = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  if (normalized.startsWith('image/')) return 'image'
  if (normalized.startsWith('video/')) return 'video'
  if (normalized.startsWith('audio/')) return 'audio'
  if (normalized === 'application/pdf') return 'pdf'
  return 'unknown'
}

export function getIntrinsicAspectRatio(width: number, height: number): number | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  return Number((width / height).toFixed(6))
}

export function getEmbedMediaAspectRatio(mediaLayout: EmbedMediaLayout | null) {
  if (
    mediaLayout?.kind === 'intrinsicAspectRatio' &&
    typeof mediaLayout.aspectRatio === 'number' &&
    Number.isFinite(mediaLayout.aspectRatio) &&
    mediaLayout.aspectRatio > 0
  ) {
    return mediaLayout.aspectRatio
  }

  return null
}

export function areEmbedMediaLayoutsEqual(
  currentLayout: EmbedMediaLayout | null,
  nextLayout: EmbedMediaLayout,
) {
  if (!currentLayout || currentLayout.kind !== nextLayout.kind) return false
  switch (currentLayout.kind) {
    case 'fixedHeight':
      return nextLayout.kind === 'fixedHeight' && currentLayout.height === nextLayout.height
    case 'intrinsicAspectRatio':
      return (
        nextLayout.kind === 'intrinsicAspectRatio' &&
        currentLayout.aspectRatio === nextLayout.aspectRatio
      )
  }
}
