import { describe, expect, it } from 'vite-plus/test'
import { getAuthBaseUrlConfig, parseAllowedHosts } from '../trustedOrigins'

describe('parseAllowedHosts', () => {
  it('trims, drops empty entries, and deduplicates hosts', () => {
    expect(
      parseAllowedHosts(
        ' wizardarchive.com, ,www.wizardarchive.com,wizardarchive.com,candidate.wizardarchive.com ',
      ),
    ).toEqual(['wizardarchive.com', 'www.wizardarchive.com', 'candidate.wizardarchive.com'])
  })

  it('preserves exact host strings including ports', () => {
    expect(parseAllowedHosts('localhost:3000,grandiose-cassowary-420.convex.site')).toEqual([
      'localhost:3000',
      'grandiose-cassowary-420.convex.site',
    ])
  })

  it('returns an empty list when the env value is missing or blank', () => {
    expect(parseAllowedHosts(undefined)).toEqual([])
    expect(parseAllowedHosts(' ,  , ')).toEqual([])
  })
})

describe('getAuthBaseUrlConfig', () => {
  it('returns a Better Auth dynamic base URL config', () => {
    expect(getAuthBaseUrlConfig('wizardarchive.com,www.wizardarchive.com')).toEqual({
      allowedHosts: ['wizardarchive.com', 'www.wizardarchive.com'],
      protocol: 'auto',
    })
  })

  it('fails clearly when BETTER_AUTH_ALLOWED_HOSTS is empty', () => {
    expect(() => getAuthBaseUrlConfig('')).toThrow(
      'BETTER_AUTH_ALLOWED_HOSTS must contain at least one host',
    )
  })
})
