import { inferExternalEmbedMediaKind } from 'shared/embeds/embedTargets'

export type EmbedMediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'unknown'
export type IntrinsicAspectRatioReporter = (aspectRatio: number | null) => void

export function inferEmbedMediaKindFromUrl(url: string): EmbedMediaKind {
  return inferExternalEmbedMediaKind(url)
}

export function inferEmbedMediaKindFromContentType(
  contentType: string | null | undefined,
): EmbedMediaKind {
  if (!contentType) return 'unknown'

  const normalized = contentType.toLowerCase()
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
