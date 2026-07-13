import { describe, expect, it } from 'vite-plus/test'
import {
  VERSION_SCHEME,
  advanceVersion,
  assertSha256Digest,
  assertVersionStamp,
  compareVersionStamps,
  initialVersion,
  successorVersion,
} from '../component-version'

const digest = (character: string) => assertSha256Digest(character.repeat(64))

describe('authoritative-revision-v1', () => {
  it('validates the single concrete V1 scheme', () => {
    expect(
      assertVersionStamp({ scheme: VERSION_SCHEME, revision: 0, digest: digest('a') }),
    ).toEqual({ scheme: VERSION_SCHEME, revision: 0, digest: digest('a') })
    expect(() =>
      assertVersionStamp({ scheme: 'vector-clock-v2', revision: 1, digest: digest('a') }),
    ).toThrow()
    expect(() =>
      assertVersionStamp({ scheme: VERSION_SCHEME, revision: -1, digest: digest('a') }),
    ).toThrow()
    expect(() => assertSha256Digest('A'.repeat(64))).toThrow()
  })

  it('compares data and revisions exactly', () => {
    const destination = { scheme: VERSION_SCHEME, revision: 2, digest: digest('a') } as const

    expect(
      compareVersionStamps(
        { scheme: VERSION_SCHEME, revision: 5, digest: digest('a') },
        destination,
      ),
    ).toEqual({
      relation: 'equal',
      frontier: { scheme: VERSION_SCHEME, revision: 5, digest: digest('a') },
    })
    expect(
      compareVersionStamps(
        { scheme: VERSION_SCHEME, revision: 3, digest: digest('b') },
        destination,
      ),
    ).toEqual({ relation: 'import_newer' })
    expect(
      compareVersionStamps(
        { scheme: VERSION_SCHEME, revision: 1, digest: digest('b') },
        destination,
      ),
    ).toEqual({ relation: 'destination_newer' })
    expect(
      compareVersionStamps(
        { scheme: VERSION_SCHEME, revision: 2, digest: digest('b') },
        destination,
      ),
    ).toEqual({ relation: 'unknown' })
  })

  it('preserves no-ops, advances real changes once, and rejects exhaustion', () => {
    const current = initialVersion(digest('a'))

    expect(current.revision).toBe(1)
    expect(advanceVersion(current, current.digest)).toBe(current)
    expect(advanceVersion(current, digest('b'))).toEqual({
      scheme: VERSION_SCHEME,
      revision: 2,
      digest: digest('b'),
    })
    expect(() =>
      successorVersion(
        { scheme: VERSION_SCHEME, revision: Number.MAX_SAFE_INTEGER, digest: digest('a') },
        digest('b'),
      ),
    ).toThrow('version_exhausted')
  })
})
