import { describe, expect, it } from 'vitest'
import { getTrustedOrigins } from '../trustedOrigins'

describe('getTrustedOrigins', () => {
  it('trusts the www sibling for an apex production URL', () => {
    expect(getTrustedOrigins('https://wizardarchive.com')).toEqual([
      'https://wizardarchive.com',
      'https://www.wizardarchive.com',
    ])
  })

  it('trusts the apex sibling for a www production URL', () => {
    expect(getTrustedOrigins('https://www.wizardarchive.com')).toEqual([
      'https://www.wizardarchive.com',
      'https://wizardarchive.com',
    ])
  })

  it('does not invent variants for localhost or preview subdomains', () => {
    expect(getTrustedOrigins('http://localhost:3000')).toEqual(['http://localhost:3000'])
    expect(getTrustedOrigins('https://preview-12.wizardarchive.com')).toEqual([
      'https://preview-12.wizardarchive.com',
    ])
  })
})
