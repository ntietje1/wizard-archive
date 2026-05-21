import {
  CAMPAIGN_NAME_MAX_LENGTH,
  CAMPAIGN_NAME_MIN_LENGTH,
  CAMPAIGN_SLUG_MAX_LENGTH,
} from './constants'
import { createSlugHelpers } from '../common/slug'
import type { BrandedString } from '../common/slug'
import { ERROR_CODE, throwClientError } from '../errors'

export type CampaignSlug = BrandedString<'CampaignSlug'>

const campaignSlugHelpers = createSlugHelpers<'CampaignSlug'>({
  label: 'Campaign link',
  maxLength: CAMPAIGN_SLUG_MAX_LENGTH,
})

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
