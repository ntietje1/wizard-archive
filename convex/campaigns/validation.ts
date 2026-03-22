import {
  CAMPAIGN_NAME_MAX_LENGTH,
  CAMPAIGN_NAME_MIN_LENGTH,
  CAMPAIGN_SLUG_MAX_LENGTH,
  CAMPAIGN_SLUG_MIN_LENGTH,
} from './constants'

export function removeInvalidSlugCharacters(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, '').replace(/--+/g, '-')
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

export function validateCampaignSlug(slug: string): string | null {
  const trimmed = slug.trim()
  if (!trimmed) return 'Campaign link is required'
  const normalized = removeInvalidSlugCharacters(trimmed)
  if (normalized !== trimmed) {
    return 'Link can only contain letters, numbers, and single hyphens'
  }
  if (normalized.startsWith('-') || normalized.endsWith('-')) {
    return 'Link cannot start or end with a hyphen'
  }
  if (normalized.length < CAMPAIGN_SLUG_MIN_LENGTH)
    return `Campaign link must be at least ${CAMPAIGN_SLUG_MIN_LENGTH} characters`
  if (normalized.length > CAMPAIGN_SLUG_MAX_LENGTH)
    return `Campaign link must be at most ${CAMPAIGN_SLUG_MAX_LENGTH} characters`
  return null
}
