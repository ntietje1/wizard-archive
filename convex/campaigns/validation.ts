import { prepareCampaignName as prepareSharedCampaignName } from '../../shared/campaigns/validation'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'

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
