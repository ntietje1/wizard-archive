import { initialVersion, sha256Digest } from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'

const textEncoder = new TextEncoder()

export type ContentMergeRejection = Readonly<{
  status: 'rejected'
  reason: 'content_corrupt' | 'version_exhausted'
}>

export function contentMergeRejection(error: unknown): ContentMergeRejection {
  return {
    status: 'rejected',
    reason: error instanceof RangeError ? 'version_exhausted' : 'content_corrupt',
  }
}

export async function initialJsonContentVersion(value: unknown): Promise<VersionStamp> {
  return initialVersion(await sha256Digest(textEncoder.encode(JSON.stringify(value))))
}

export async function initialBinaryContentVersion(value: ArrayBuffer): Promise<VersionStamp> {
  return initialVersion(await sha256Digest(new Uint8Array(value)))
}
