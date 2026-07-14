import { z } from 'zod'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'

export const externalEmbedUrlSchema = z.string().refine(isHttpsUrl, {
  message: 'External embed URL must use HTTPS',
})

export const embedTargetKindSchema = z.enum(['empty', 'resource', 'externalUrl'])

const emptyEmbedTargetSchema = z.strictObject({
  kind: z.literal('empty'),
})

const resourceEmbedTargetSchema = z.strictObject({
  kind: z.literal('resource'),
  resourceId: z.string().min(1),
})

const externalUrlEmbedTargetSchema = z.strictObject({
  kind: z.literal('externalUrl'),
  url: externalEmbedUrlSchema,
  name: z.string().trim().min(1).nullable(),
})

export const embedTargetSchema = z.discriminatedUnion('kind', [
  emptyEmbedTargetSchema,
  resourceEmbedTargetSchema,
  externalUrlEmbedTargetSchema,
])

type EmptyEmbedTarget = z.infer<typeof emptyEmbedTargetSchema>
type ResourceEmbedTarget = Omit<z.infer<typeof resourceEmbedTargetSchema>, 'resourceId'> & {
  resourceId: ResourceId
}
type ExternalUrlEmbedTarget = z.infer<typeof externalUrlEmbedTargetSchema>

export type EmbedTarget = EmptyEmbedTarget | ResourceEmbedTarget | ExternalUrlEmbedTarget
type ExternalEmbedMediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'unknown'

const MEDIA_EXTENSION_BY_KIND: Record<Exclude<ExternalEmbedMediaKind, 'unknown'>, Set<string>> = {
  image: new Set(['apng', 'avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'webp']),
  video: new Set(['m4v', 'mov', 'mp4', 'ogv', 'webm']),
  audio: new Set(['aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'opus', 'wav', 'weba']),
  pdf: new Set(['pdf']),
}

export function normalizeEmbedTarget(value: unknown): EmbedTarget {
  return parseEmbedTarget(value) ?? { kind: 'empty' }
}

export function parseEmbedTarget(value: unknown): EmbedTarget | null {
  const result = embedTargetSchema.safeParse(value)
  if (!result.success) return null
  const target = result.data
  if (target.kind !== 'resource') return target
  return {
    kind: 'resource',
    resourceId: target.resourceId as ResourceId,
  }
}

export function inferExternalEmbedMediaKind(url: string): ExternalEmbedMediaKind {
  const extension = getUrlExtension(url)
  if (!extension) return 'unknown'

  for (const [kind, extensions] of Object.entries(MEDIA_EXTENSION_BY_KIND)) {
    if (extensions.has(extension)) return kind as Exclude<ExternalEmbedMediaKind, 'unknown'>
  }

  return 'unknown'
}

export function deriveExternalEmbedName(url: string): string | null {
  try {
    const parsed = new URL(url)
    const pathSegments = parsed.pathname.split('/').filter(Boolean)
    const filename = decodeURIComponent(pathSegments[pathSegments.length - 1] ?? '')
    return filename || parsed.hostname
  } catch {
    return null
  }
}

function getUrlExtension(url: string): string | null {
  try {
    const parsed = new URL(url)
    const pathSegments = parsed.pathname.split('/')
    const filename = pathSegments[pathSegments.length - 1] ?? ''
    const dotIndex = filename.lastIndexOf('.')
    if (dotIndex < 0 || dotIndex === filename.length - 1) return null
    return filename.slice(dotIndex + 1).toLowerCase()
  } catch {
    return null
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
