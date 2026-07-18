import { advanceVersion, initialVersion, sha256Digest } from './component-version'
import type { VersionStamp } from './component-version'
import type { FileOwnedMetadata } from './file-content-contract'

const encoder = new TextEncoder()

function uint64(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid content byte length')
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value))
  return bytes
}

function encodeParts(label: string, parts: ReadonlyArray<Uint8Array>): Uint8Array {
  const labelBytes = encoder.encode(label)
  const byteLength =
    labelBytes.byteLength + 1 + parts.reduce((total, part) => total + 8 + part.byteLength, 0)
  const encoded = new Uint8Array(byteLength)
  let offset = 0
  encoded.set(labelBytes, offset)
  offset += labelBytes.byteLength
  encoded[offset++] = 0
  for (const part of parts) {
    encoded.set(uint64(part.byteLength), offset)
    offset += 8
    encoded.set(part, offset)
    offset += part.byteLength
  }
  return encoded
}

function fileMetadataBytes(metadata: FileOwnedMetadata): Uint8Array {
  return encoder.encode(
    JSON.stringify({
      byteSize: metadata.byteSize,
      classification: metadata.classification,
      detectedFormat: metadata.detectedFormat,
      extension: metadata.extension,
      mediaType: metadata.mediaType,
      viewerUnavailableReason: metadata.viewerUnavailableReason,
    }),
  )
}

export async function noteContentDigest(update: Uint8Array) {
  return await sha256Digest(encodeParts('note-content-v1', [update]))
}

export async function initialNoteContentVersion(update: Uint8Array): Promise<VersionStamp> {
  return initialVersion(await noteContentDigest(update))
}

export async function advanceNoteContentVersion(
  current: VersionStamp,
  update: Uint8Array,
): Promise<VersionStamp> {
  return advanceVersion(current, await noteContentDigest(update))
}

export async function noteContentProjectionVersion(
  canonical: VersionStamp,
  update: Uint8Array,
): Promise<VersionStamp> {
  const canonicalIdentity = encoder.encode(
    `${canonical.scheme}:${canonical.revision}:${canonical.digest}`,
  )
  return {
    ...canonical,
    digest: await sha256Digest(
      encodeParts('note-content-projection-v1', [canonicalIdentity, update]),
    ),
  }
}

export async function fileContentDigest(bytes: Uint8Array, metadata: FileOwnedMetadata) {
  if (bytes.byteLength !== metadata.byteSize) {
    throw new TypeError('File byte size does not match canonical metadata')
  }
  return await sha256Digest(encodeParts('file-content-v1', [fileMetadataBytes(metadata), bytes]))
}

export async function initialFileContentVersion(
  bytes: Uint8Array,
  metadata: FileOwnedMetadata,
): Promise<VersionStamp> {
  return initialVersion(await fileContentDigest(bytes, metadata))
}

export async function advanceFileContentVersion(
  current: VersionStamp,
  bytes: Uint8Array,
  metadata: FileOwnedMetadata,
): Promise<VersionStamp> {
  return advanceVersion(current, await fileContentDigest(bytes, metadata))
}
