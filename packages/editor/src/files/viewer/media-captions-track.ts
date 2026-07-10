import { isValidFileUrl } from './file-url-validation'

export type MediaCaptionsTrackSource = {
  label: string
  src: string
  srcLang: string
}

type MediaCaptionsTrackState = {
  source: MediaCaptionsTrackSource
  status: 'provided' | 'unavailable'
}

const UNAVAILABLE_CAPTIONS_TRACK: MediaCaptionsTrackSource = {
  label: 'Captions unavailable',
  src: `data:text/vtt;charset=utf-8,${encodeURIComponent(
    [
      'WEBVTT',
      '',
      '00:00:00.000 --> 99:59:59.000',
      'Captions are not available for this file.',
      '',
    ].join('\n'),
  )}`,
  srcLang: 'en',
}

export function resolveMediaCaptionsTrack({
  allowDataUrl = false,
  allowObjectUrl = false,
  captions,
}: {
  allowDataUrl?: boolean
  allowObjectUrl?: boolean
  captions?: MediaCaptionsTrackSource
}): MediaCaptionsTrackState {
  if (captions && isValidFileUrl(captions.src, { allowDataUrl, allowObjectUrl })) {
    return { source: captions, status: 'provided' }
  }

  return { source: UNAVAILABLE_CAPTIONS_TRACK, status: 'unavailable' }
}
