import type { SyntheticEvent } from 'react'
import { AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK, intrinsicMediaAspectRatio } from './embed-media-layout'
import type { EmbedMediaLayoutReporter } from './embed-media-layout'

const UNAVAILABLE_CAPTIONS = `data:text/vtt;charset=utf-8,${encodeURIComponent(
  ['WEBVTT', '', '00:00:00.000 --> 99:59:59.000', 'Captions are not available.', ''].join('\n'),
)}`

type EmbeddedMediaProps =
  | Readonly<{
      alt: string
      kind: 'image'
      onError?: (event: SyntheticEvent<HTMLImageElement>) => void
      onMediaLayout?: EmbedMediaLayoutReporter
      url: string
    }>
  | Readonly<{
      kind: 'audio'
      onError?: (event: SyntheticEvent<HTMLAudioElement>) => void
      onMediaLayout?: EmbedMediaLayoutReporter
      url: string
    }>
  | Readonly<{
      kind: 'video'
      onError?: (event: SyntheticEvent<HTMLVideoElement>) => void
      onMediaLayout?: EmbedMediaLayoutReporter
      url: string
    }>

export function EmbeddedMedia(props: EmbeddedMediaProps) {
  switch (props.kind) {
    case 'image':
      return (
        <img
          alt={props.alt}
          className="size-full select-none object-contain"
          draggable={false}
          src={props.url}
          onError={props.onError}
          onLoad={(event) =>
            props.onMediaLayout?.({
              kind: 'intrinsicAspectRatio',
              aspectRatio: intrinsicMediaAspectRatio(
                event.currentTarget.naturalWidth,
                event.currentTarget.naturalHeight,
              ),
            })
          }
        />
      )
    case 'audio':
      return (
        <audio
          className="w-full"
          controls
          src={props.url}
          onError={props.onError}
          onLoadedMetadata={(event) =>
            props.onMediaLayout?.({
              kind: 'fixedHeight',
              height:
                event.currentTarget.getBoundingClientRect().height ||
                AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK,
            })
          }
        >
          <UnavailableCaptions />
          Your browser does not support audio playback.
        </audio>
      )
    case 'video':
      return (
        <video
          className="size-full object-contain"
          controls
          src={props.url}
          onError={props.onError}
          onLoadedMetadata={(event) =>
            props.onMediaLayout?.({
              kind: 'intrinsicAspectRatio',
              aspectRatio: intrinsicMediaAspectRatio(
                event.currentTarget.videoWidth,
                event.currentTarget.videoHeight,
              ),
            })
          }
        >
          <UnavailableCaptions />
          Your browser does not support video playback.
        </video>
      )
  }
}

function UnavailableCaptions() {
  return (
    <track
      default
      kind="captions"
      label="Captions unavailable"
      src={UNAVAILABLE_CAPTIONS}
      srcLang="en"
    />
  )
}
