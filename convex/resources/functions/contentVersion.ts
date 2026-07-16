import * as Y from 'yjs'
import { initialVersion, sha256Digest } from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'

const textEncoder = new TextEncoder()

export type ContentMergeRejection = Readonly<{
  status: 'rejected'
  reason: 'content_corrupt' | 'version_exhausted'
}>

export type ContentMergeRetry = Readonly<{
  status: 'retryable'
  reason: 'dependency_pending'
  stateVector: ArrayBuffer
}>

export function applyYjsContentDelta(
  document: Y.Doc,
  current: ArrayBuffer,
  delta: ArrayBuffer,
): ContentMergeRetry | null {
  Y.applyUpdate(document, new Uint8Array(current))
  const stateVector = Uint8Array.from(Y.encodeStateVector(document)).buffer
  Y.applyUpdate(document, new Uint8Array(delta))
  if (!hasUnresolvedYjsDependencies(document)) return null
  return { status: 'retryable', reason: 'dependency_pending', stateVector }
}

function hasUnresolvedYjsDependencies(document: Y.Doc): boolean {
  // Yjs retains causally unavailable structs and delete sets here. Validating the
  // visible partial document would misclassify a valid concurrent update as corrupt.
  return document.store.pendingStructs !== null || document.store.pendingDs !== null
}

export function contentMergeRejection(error: unknown): ContentMergeRejection {
  return {
    status: 'rejected',
    reason: error instanceof RangeError ? 'version_exhausted' : 'content_corrupt',
  }
}

export async function initialJsonContentVersion(value: unknown): Promise<VersionStamp> {
  return initialVersion(await jsonContentDigest(value))
}

export async function jsonContentDigest(value: unknown) {
  return await sha256Digest(textEncoder.encode(JSON.stringify(value)))
}

export async function initialBinaryContentVersion(value: ArrayBuffer): Promise<VersionStamp> {
  return initialVersion(await sha256Digest(new Uint8Array(value)))
}
