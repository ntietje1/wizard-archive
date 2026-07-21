import {
  CAMPAIGN_NAME_MAX_LENGTH,
  CAMPAIGN_NAME_MIN_LENGTH,
  CAMPAIGN_SLUG_MAX_LENGTH,
} from './constants'
import { brandString } from '../branded'
import type { BrandedString } from '../branded'

export type CampaignSlug = BrandedString<'CampaignSlug'>

export function validateCampaignSlug(value: string): string | null {
  if (value.trim().length === 0) return 'Campaign link is required'
  if (value !== value.trim()) return 'Campaign link cannot start or end with whitespace'
  if (/[A-Z]/.test(value)) return 'Campaign link cannot contain uppercase letters'
  if (/\s/.test(value)) return 'Campaign link cannot contain spaces'
  if (/[^a-z0-9_-]/.test(value)) {
    return 'Campaign link can only contain lowercase letters, numbers, hyphens, and underscores'
  }
  if (/^[-_]|[-_]$/.test(value)) return 'Campaign link cannot start or end with a separator'
  if (/[-_]{2,}/.test(value)) return 'Campaign link cannot contain consecutive separators'
  if (value.length > CAMPAIGN_SLUG_MAX_LENGTH) {
    return `Campaign link must be at most ${CAMPAIGN_SLUG_MAX_LENGTH} characters`
  }
  return null
}

export function parseCampaignSlug(value: string): CampaignSlug | null {
  return validateCampaignSlug(value) === null ? brandString<'CampaignSlug'>(value) : null
}

export function assertCampaignSlug(value: string): CampaignSlug {
  const slug = parseCampaignSlug(value)
  if (!slug) throw new Error(validateCampaignSlug(value) ?? 'Invalid campaign link')
  return slug
}

export function campaignSlugFromName(name: string): CampaignSlug {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/[-_]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, CAMPAIGN_SLUG_MAX_LENGTH)
    .replace(/[-_]+$/g, '')
  return assertCampaignSlug(normalized || 'campaign')
}

export function campaignSlugWithSuffix(base: CampaignSlug, suffixNumber: number): CampaignSlug {
  const suffix = `-${suffixNumber}`
  const root = base.slice(0, CAMPAIGN_SLUG_MAX_LENGTH - suffix.length).replace(/[-_]+$/g, '')
  return assertCampaignSlug(`${root}${suffix}`)
}

export function validateCampaignName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Campaign name is required'
  if (trimmed.length < CAMPAIGN_NAME_MIN_LENGTH)
    return `Campaign name must be at least ${CAMPAIGN_NAME_MIN_LENGTH} characters`
  if (trimmed.length > CAMPAIGN_NAME_MAX_LENGTH)
    return `Campaign name must be at most ${CAMPAIGN_NAME_MAX_LENGTH} characters`
  return null
}

export function prepareCampaignName(name: string): string {
  const trimmed = name.trim()
  const error = validateCampaignName(trimmed)
  if (error) {
    throw new Error(error)
  }
  return trimmed
}

export function prepareCampaignDescription(description?: string): string | undefined {
  return description?.trim()
}
