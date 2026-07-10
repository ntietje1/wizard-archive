import { isValidFileUrl } from './file-url-validation'
import { resolveMediaCaptionsTrack } from './media-captions-track'
import type { MediaCaptionsTrackSource } from './media-captions-track'

type ValidatedMediaFileSource =
  | { status: 'invalid' }
  | {
      status: 'valid'
      captionsTrack: ReturnType<typeof resolveMediaCaptionsTrack>
    }

export type ValidMediaFileSource = Extract<ValidatedMediaFileSource, { status: 'valid' }>

function resolveValidatedMediaFileSource({
  allowDataUrl = false,
  allowObjectUrl = false,
  captions,
  sourceUrl,
}: {
  allowDataUrl?: boolean
  allowObjectUrl?: boolean
  captions?: MediaCaptionsTrackSource
  sourceUrl: string
}): ValidatedMediaFileSource {
  if (!isValidFileUrl(sourceUrl, { allowDataUrl, allowObjectUrl })) {
    return { status: 'invalid' }
  }

  return {
    status: 'valid',
    captionsTrack: resolveMediaCaptionsTrack({ allowDataUrl, captions, allowObjectUrl }),
  }
}

export function getValidMediaFileSource(input: {
  allowDataUrl?: boolean
  allowObjectUrl?: boolean
  captions?: MediaCaptionsTrackSource
  sourceUrl: string
}): ValidMediaFileSource | null {
  const mediaSource = resolveValidatedMediaFileSource(input)
  return mediaSource.status === 'valid' ? mediaSource : null
}
