import { createHash } from 'node:crypto'
import { CAMPAIGN_NAME_MAX_LENGTH } from '../../shared/campaigns/constants'

export const AUTH_STORAGE_PATH = 'e2e/.auth/user.json'

export const TEST_RUN_ID = process.env.TEST_RUN_ID || String(Date.now())

export function testName(base: string): string {
  const runHash = createHash('sha256').update(TEST_RUN_ID).digest('hex').slice(0, 8)
  const suffix = ` [${runHash}]`
  return `${base.slice(0, CAMPAIGN_NAME_MAX_LENGTH - suffix.length).trimEnd()}${suffix}`
}
