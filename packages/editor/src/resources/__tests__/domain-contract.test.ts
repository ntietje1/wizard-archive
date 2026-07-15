import { describe, expect, it } from 'vite-plus/test'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
  isUuidV7,
  parseDomainId,
} from '../domain-id'
import { RESOURCE_KIND, canonicalizeResourceTitle } from '../resource-record'

describe('canonical domain identity', () => {
  it('accepts only lowercase RFC 9562 UUIDv7 values', () => {
    const value = '01890f47-f6c8-7a5b-8c9d-0123456789ab'

    expect(isUuidV7(value)).toBe(true)
    expect(parseDomainId(DOMAIN_ID_KIND.resource, value)).toBe(value)
    expect(isUuidV7(value.toUpperCase())).toBe(false)
    expect(isUuidV7('01890f47-f6c8-6a5b-8c9d-0123456789ab')).toBe(false)
    expect(() => assertDomainId(DOMAIN_ID_KIND.resource, 'sidebar-item-1')).toThrow()
  })

  it('generates final UUIDv7 identities at the owning intent boundary', () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const userProfileId = generateDomainId(DOMAIN_ID_KIND.userProfile)

    expect(isUuidV7(resourceId)).toBe(true)
    expect(isUuidV7(operationId)).toBe(true)
    expect(isUuidV7(userProfileId)).toBe(true)
    expect(resourceId).not.toBe(operationId)
  })
})

describe('canonical resource record values', () => {
  it('uses only the five canonical resource kinds', () => {
    expect(Object.values(RESOURCE_KIND).sort()).toEqual(['canvas', 'file', 'folder', 'map', 'note'])
  })

  it('canonicalizes natural titles without filesystem or sibling rules', () => {
    expect(canonicalizeResourceTitle('  A/B:*?  ')).toBe('A/B:*?')
    expect(canonicalizeResourceTitle('e\u0301\r\n\tname')).toBe('é name')
    expect(canonicalizeResourceTitle('\u0000\u2028')).toBe('Untitled')
    expect(canonicalizeResourceTitle('Duplicate')).toBe(canonicalizeResourceTitle('Duplicate'))
    expect(() => canonicalizeResourceTitle('\ud800')).toThrow(/unpaired UTF-16/)
    expect(() => canonicalizeResourceTitle('x'.repeat(256))).toThrow(/255 scalars/)
  })
})
