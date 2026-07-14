import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import type { ImportJobId, ResourceId } from '../domain-id'
import {
  createSourcePathAlias,
  normalizeSourcePath,
  resolveSourcePathAlias,
} from '../source-path-alias'

const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, '01890f40-f6c8-7a5b-8c9d-0123456789ab')
const importJobId = assertDomainId(DOMAIN_ID_KIND.importJob, '01890f41-f6c8-7a5b-8c9d-0123456789ab')

describe('source path aliases', () => {
  it('normalizes one safe relative path without changing case', () => {
    expect(normalizeSourcePath('Notes\\.\\Cafe\u0301.md')).toBe('Notes/Café.md')
    expect(normalizeSourcePath('UPPER/Entry.MD')).toBe('UPPER/Entry.MD')
  })

  it.each([
    '',
    '.',
    '/',
    '/root.md',
    'C:\\root.md',
    '\\\\server\\root.md',
    '../root.md',
    'a/../b',
    'a//b',
    'a/',
  ])('rejects unsafe source path %j', (rawPath) => {
    expect(() => normalizeSourcePath(rawPath)).toThrow()
  })

  it('rejects malformed Unicode', () => {
    expect(() => normalizeSourcePath('\ud800')).toThrow(/malformed Unicode/)
  })

  it('resolves exact path before an ambiguous basename', () => {
    const firstId = resourceId('01890f42-f6c8-7a5b-8c9d-0123456789ab')
    const secondId = resourceId('01890f43-f6c8-7a5b-8c9d-0123456789ab')
    const aliases = [alias(firstId, 'Notes/Entry.md'), alias(secondId, 'Archive/Entry.md')]

    expect(resolve(aliases, 'Notes/Entry.md')).toEqual({
      status: 'resolved',
      resourceId: firstId,
    })
    expect(resolve(aliases, 'Entry.md')).toEqual({
      status: 'ambiguous',
      resourceIds: [firstId, secondId],
    })
  })

  it('falls back to a unique exact basename and then a unique stem', () => {
    const firstId = resourceId('01890f44-f6c8-7a5b-8c9d-0123456789ab')
    const secondId = resourceId('01890f45-f6c8-7a5b-8c9d-0123456789ab')
    const aliases = [alias(firstId, 'Notes/Unique.md'), alias(secondId, 'Other/Else.txt')]

    expect(resolve(aliases, 'Unique.md')).toEqual({ status: 'resolved', resourceId: firstId })
    expect(resolve(aliases, 'Unique.txt')).toEqual({ status: 'resolved', resourceId: firstId })
    expect(resolve(aliases, 'unique.md')).toEqual({ status: 'missing' })
  })

  it('keeps ambiguity explicit and scopes candidates to one import source', () => {
    const firstId = resourceId('01890f46-f6c8-7a5b-8c9d-0123456789ab')
    const secondId = resourceId('01890f47-f6c8-7a5b-8c9d-0123456789ab')
    const otherJobId = assertDomainId(
      DOMAIN_ID_KIND.importJob,
      '01890f48-f6c8-7a5b-8c9d-0123456789ab',
    )
    const aliases = [
      alias(firstId, 'A/Same.md'),
      alias(secondId, 'B/Same.txt'),
      alias(secondId, 'A/Only.md', otherJobId),
    ]

    expect(resolve(aliases, 'Same.rtf')).toEqual({
      status: 'ambiguous',
      resourceIds: [firstId, secondId],
    })
    expect(resolve(aliases, 'Only.md')).toEqual({ status: 'missing' })
  })
})

function resourceId(value: string): ResourceId {
  return assertDomainId(DOMAIN_ID_KIND.resource, value)
}

function alias(id: ResourceId, rawPath: string, jobId: ImportJobId = importJobId) {
  return createSourcePathAlias({
    campaignId,
    importJobId: jobId,
    rawPath,
    resourceId: id,
    sourceRootId: 'upload',
  })
}

function resolve(aliases: ReadonlyArray<ReturnType<typeof alias>>, rawPath: string) {
  return resolveSourcePathAlias(aliases, { importJobId, rawPath, sourceRootId: 'upload' })
}
