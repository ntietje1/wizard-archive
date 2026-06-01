import { v } from 'convex/values'
import {
  assertCampaignSlug as assertSharedCampaignSlug,
  prepareCampaignName as prepareSharedCampaignName,
} from '../../shared/campaigns/validation'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import type { CampaignSlug } from '../../shared/campaigns/validation'

export const campaignSlugValidator = v.string()

export function assertCampaignSlug(value: string): CampaignSlug {
  try {
    return assertSharedCampaignSlug(value)
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid campaign link',
    )
  }
}

export function prepareCampaignName(value: string): string {
  try {
    return prepareSharedCampaignName(value)
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid campaign name',
    )
  }
}
