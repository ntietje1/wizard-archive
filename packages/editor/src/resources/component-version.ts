declare const sha256DigestBrand: unique symbol

export const VERSION_SCHEME = 'authoritative-revision-v1' as const

export type Sha256Digest = string & { readonly [sha256DigestBrand]: true }

export type VersionStamp = Readonly<{
  scheme: typeof VERSION_SCHEME
  revision: number
  digest: Sha256Digest
}>

export type VersionRelation = 'equal' | 'import_newer' | 'destination_newer' | 'unknown'

export type VersionComparison =
  | { readonly relation: 'equal'; readonly frontier: VersionStamp }
  | { readonly relation: Exclude<VersionRelation, 'equal'> }

const SHA256_PATTERN = /^[0-9a-f]{64}$/

export function parseSha256Digest(value: string): Sha256Digest | null {
  return SHA256_PATTERN.test(value) ? (value as Sha256Digest) : null
}

export function assertSha256Digest(value: string): Sha256Digest {
  const parsed = parseSha256Digest(value)
  if (!parsed) throw new TypeError('Expected a lowercase SHA-256 digest')
  return parsed
}

export function isVersionStamp(value: unknown): value is VersionStamp {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<VersionStamp>
  return (
    candidate.scheme === VERSION_SCHEME &&
    Number.isSafeInteger(candidate.revision) &&
    candidate.revision !== undefined &&
    candidate.revision >= 0 &&
    typeof candidate.digest === 'string' &&
    parseSha256Digest(candidate.digest) !== null
  )
}

export function assertVersionStamp(value: unknown): VersionStamp {
  if (!isVersionStamp(value)) throw new TypeError('Invalid authoritative-revision-v1 stamp')
  return value
}

export function compareVersionStamps(
  imported: VersionStamp,
  destination: VersionStamp,
): VersionComparison {
  if (imported.digest === destination.digest) {
    return {
      relation: 'equal',
      frontier: imported.revision >= destination.revision ? imported : destination,
    }
  }
  if (imported.revision > destination.revision) return { relation: 'import_newer' }
  if (destination.revision > imported.revision) return { relation: 'destination_newer' }
  return { relation: 'unknown' }
}

export function initialVersion(digest: Sha256Digest): VersionStamp {
  return { scheme: VERSION_SCHEME, revision: 1, digest }
}

export function advanceVersion(current: VersionStamp, digest: Sha256Digest): VersionStamp {
  if (current.digest === digest) return current
  return successorVersion(current, digest)
}

export function successorVersion(current: VersionStamp, digest: Sha256Digest): VersionStamp {
  if (current.revision === Number.MAX_SAFE_INTEGER) throw new RangeError('version_exhausted')
  return { scheme: VERSION_SCHEME, revision: current.revision + 1, digest }
}

export async function sha256Digest(bytes: Uint8Array): Promise<Sha256Digest> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
  return assertSha256Digest(
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  )
}
