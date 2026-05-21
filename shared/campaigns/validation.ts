import {
  CAMPAIGN_NAME_MAX_LENGTH,
  CAMPAIGN_NAME_MIN_LENGTH,
  CAMPAIGN_SLUG_MAX_LENGTH,
} from './constants'
import { brandString } from '../branded'
import { parseSlug, validateSlug } from '../slugs'
import type { BrandedString } from '../branded'

export type CampaignSlug = BrandedString<'CampaignSlug'>

const CAMPAIGN_SLUG_OPTIONS = {
  label: 'Campaign link',
  maxLength: CAMPAIGN_SLUG_MAX_LENGTH,
} as const

export function validateCampaignSlug(value: string): string | null {
  return validateSlug(value, CAMPAIGN_SLUG_OPTIONS)
}

export function parseCampaignSlug(value: string): CampaignSlug | null {
  const parsed = parseSlug(value, CAMPAIGN_SLUG_OPTIONS)
  return parsed ? brandString<'CampaignSlug'>(parsed) : null
}

export function assertCampaignSlug(value: string): CampaignSlug {
  const parsed = parseCampaignSlug(value)
  if (!parsed) {
    throw new Error(validateCampaignSlug(value) ?? 'Invalid campaign link')
  }
  return parsed
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
