import { describe, expect, it } from 'vitest'
import { getAuthBaseUrlConfig, parseAllowedHosts } from '../authBaseUrl'

describe('parseAllowedHosts', () => {
  it('trims, drops empty entries, and deduplicates hosts', () => {
    expect(
      parseAllowedHosts(
        ' app.example.com, ,www.example.com,app.example.com,candidate.example.com,convex.example.site ',
      ),
    ).toEqual([
      'app.example.com',
      'www.example.com',
      'candidate.example.com',
      'convex.example.site',
    ])
  })

  it('preserves exact host strings including ports', () => {
    expect(parseAllowedHosts('localhost:3000,convex.example.site')).toEqual([
      'localhost:3000',
      'convex.example.site',
    ])
  })

  it('returns an empty list when the env value is missing or blank', () => {
    expect(parseAllowedHosts(undefined)).toEqual([])
    expect(parseAllowedHosts(' ,  , ')).toEqual([])
  })
})

describe('getAuthBaseUrlConfig', () => {
  it('returns a Better Auth dynamic base URL config', () => {
    expect(getAuthBaseUrlConfig('app.example.com,www.example.com,convex.example.site')).toEqual({
      allowedHosts: ['app.example.com', 'www.example.com', 'convex.example.site'],
      protocol: 'auto',
    })
  })

  it('fails clearly when BETTER_AUTH_ALLOWED_HOSTS is empty', () => {
    expect(() => getAuthBaseUrlConfig('')).toThrow(
      'BETTER_AUTH_ALLOWED_HOSTS must contain at least one host',
    )
  })
})
