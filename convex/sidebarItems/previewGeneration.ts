import { v } from 'convex/values'
import type { Doc } from '../_generated/dataModel'

export const PREVIEW_GENERATION_COOLDOWN_MS = 5 * 60_000

export const PREVIEW_CLAIM_UNAVAILABLE_REASON = {
  unsupported: 'unsupported',
  generationInProgress: 'generation-in-progress',
  current: 'current',
} as const

export type PreviewGenerationClaim =
  | { status: 'claimed'; claimToken: string }
  | {
      status: 'unavailable'
      reason: (typeof PREVIEW_CLAIM_UNAVAILABLE_REASON)[keyof typeof PREVIEW_CLAIM_UNAVAILABLE_REASON]
      claimToken?: never
    }

export const previewGenerationClaimValidator = v.union(
  v.object({ status: v.literal('claimed'), claimToken: v.string() }),
  v.object({
    status: v.literal('unavailable'),
    reason: v.union(
      v.literal(PREVIEW_CLAIM_UNAVAILABLE_REASON.unsupported),
      v.literal(PREVIEW_CLAIM_UNAVAILABLE_REASON.generationInProgress),
      v.literal(PREVIEW_CLAIM_UNAVAILABLE_REASON.current),
    ),
  }),
)

export type PreviewPublicationResult = { status: 'published' } | { status: 'stale' }

export const previewPublicationResultValidator = v.union(
  v.object({ status: v.literal('published') }),
  v.object({ status: v.literal('stale') }),
)

export function getPreviewContentVersion(
  item: Pick<Doc<'sidebarItems'>, '_creationTime' | 'updatedTime'>,
): number {
  return item.updatedTime ?? item._creationTime
}

export function createPreviewClaimToken(contentVersion: number): string {
  return `1:${contentVersion}:${crypto.randomUUID()}`
}

export function getPreviewClaimContentVersion(claimToken: string): number | null {
  const [formatVersion, contentVersion] = claimToken.split(':')
  if (formatVersion !== '1' || !contentVersion) return null
  const parsedVersion = Number(contentVersion)
  return Number.isFinite(parsedVersion) ? parsedVersion : null
}

export function isPreviewCurrent(
  item: Pick<Doc<'sidebarItems'>, '_creationTime' | 'updatedTime' | 'previewUpdatedAt'>,
): boolean {
  return item.previewUpdatedAt !== null && item.previewUpdatedAt >= getPreviewContentVersion(item)
}
