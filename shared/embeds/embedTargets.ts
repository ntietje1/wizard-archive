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

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
