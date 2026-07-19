import { CAMPAIGN_NAME_MAX_LENGTH, CAMPAIGN_NAME_MIN_LENGTH } from './constants'

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
