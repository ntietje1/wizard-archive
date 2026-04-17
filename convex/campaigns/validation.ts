import {
  CAMPAIGN_NAME_MAX_LENGTH,
  CAMPAIGN_NAME_MIN_LENGTH,
  CAMPAIGN_SLUG_MAX_LENGTH,
  CAMPAIGN_SLUG_MIN_LENGTH,
} from './constants'
import { createCanonicalSlugHelpers } from '../common/slug'
import { parseOrThrowClientValidation } from '../common/zod'
import type { BrandedString } from '../common/slug'
import { ERROR_CODE, throwClientError } from '../errors'
import { requireUsername } from '../users/validation'
import type { Username } from '../users/validation'

export type CampaignSlug = BrandedString<'CampaignSlug'>

const campaignSlugHelpers = createCanonicalSlugHelpers({
  brand: 'CampaignSlug',
  label: 'Campaign link',
  minLength: CAMPAIGN_SLUG_MIN_LENGTH,
  maxLength: CAMPAIGN_SLUG_MAX_LENGTH,
  fallbackMessage: 'Invalid campaign link',
})

export const campaignSlugValueSchema = campaignSlugHelpers.valueSchema
export const campaignSlugSchema = campaignSlugHelpers.schema
export const campaignSlugValidator = campaignSlugHelpers.validator
export const validateCampaignSlug = campaignSlugHelpers.validate
export const parseCampaignSlug = campaignSlugHelpers.parse
export const assertCampaignSlug = campaignSlugHelpers.assert

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
    throwClientError(ERROR_CODE.VALIDATION_FAILED, error)
  }
  return trimmed
}

export function prepareCampaignDescription(description?: string): string | undefined {
  return description?.trim()
}

export function requireCampaignSlug(slug: string): CampaignSlug {
  return parseOrThrowClientValidation(campaignSlugSchema, slug, 'Invalid campaign link')
}

export function requireCampaignUsername(username: string): Username {
  return requireUsername(username)
}
