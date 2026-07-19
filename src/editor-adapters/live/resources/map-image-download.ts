import { sha256Digest } from '@wizard-archive/editor/resources/component-version'
import type {
  ContentExportResult,
  MapImageAttachment,
} from '@wizard-archive/editor/resources/content-session-contract'

export async function downloadMapImage(
  expected: MapImageAttachment | undefined,
  image: MapImageAttachment,
  url: string,
): Promise<ContentExportResult> {
  if (!expected || expected.status !== 'attached' || image.status !== 'attached') {
    return { status: 'integrity_error', issue: 'content_missing' }
  }
  if (!sameMapImage(expected, image)) {
    return { status: 'integrity_error', issue: 'version_mismatch' }
  }
  const response = await fetch(url)
  if (!response.ok) return { status: 'integrity_error', issue: 'content_missing' }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength !== image.byteSize || (await sha256Digest(bytes)) !== image.digest) {
    return { status: 'integrity_error', issue: 'content_corrupt' }
  }
  return {
    status: 'ready',
    bytes,
    extension: image.mediaType.split('/')[1] ?? 'bin',
    mediaType: image.mediaType,
  }
}

function sameMapImage(left: MapImageAttachment, right: MapImageAttachment): boolean {
  return (
    left.status === 'attached' &&
    right.status === 'attached' &&
    left.byteSize === right.byteSize &&
    left.digest === right.digest &&
    left.mediaType === right.mediaType
  )
}
