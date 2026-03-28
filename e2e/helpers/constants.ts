export const AUTH_STORAGE_PATH = 'e2e/.auth/user.json'

export const TEST_RUN_ID = process.env.TEST_RUN_ID || String(Date.now())

export function testName(base: string): string {
  return `${base} [${TEST_RUN_ID}]`
}
