import { ClientOnly } from '@tanstack/react-router'
import { Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Suspense, lazy, useEffect, useLayoutEffect, useReducer, useRef } from 'react'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { cn } from '~/features/shadcn/lib/utils'
import { AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK, getIntrinsicAspectRatio } from '../utils/embed-media'
import type {
  DragEvent as ReactDragEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from 'react'
import type { EmbedMediaKind, EmbedMediaLayoutReporter } from '../utils/embed-media'

type MediaEmbedRendererProps = {
  sourceUrl: string
  label: string
  kind: EmbedMediaKind
  onMediaLayout?: EmbedMediaLayoutReporter
  renderUnknown: () => ReactNode
}

const pdfFallback = (
  <div className="flex h-full w-full items-center justify-center">
    <LoadingSpinner size="lg" />
  </div>
)

type MediaControlsState = {
  playing: boolean
  muted: boolean
  volume: number
  currentTime: number
  duration: number
}

type MediaControlsAction =
  | { type: 'sync'; state: MediaControlsState }
  | { type: 'playing'; playing: boolean }
  | { type: 'currentTime'; currentTime: number }

const initialMediaControlsState: MediaControlsState = {
  playing: false,
  muted: false,
  volume: 1,
  currentTime: 0,
  duration: 0,
}

const LazyPdfFileViewer = lazy(() =>
  import('~/features/editor/components/viewer/file/pdf-file-viewer').then((module) => ({
    default: module.PdfFileViewer,
  })),
)

export function MediaEmbedRenderer({
  sourceUrl,
  label,
  kind,
  onMediaLayout,
  renderUnknown,
}: MediaEmbedRendererProps) {
  const onMediaLayoutRef = useRef(onMediaLayout)
  const sanitizedSourceUrl = sanitizeMediaSourceUrl(sourceUrl)
  onMediaLayoutRef.current = onMediaLayout

  useLayoutEffect(() => {
    if (kind !== 'audio') {
      onMediaLayoutRef.current?.({ kind: 'intrinsicAspectRatio', aspectRatio: null })
    }
  }, [kind, sourceUrl])

  if (!sanitizedSourceUrl) return renderUnknown()

  switch (kind) {
    case 'image':
      return (
        <img
          src={sanitizedSourceUrl}
          alt={label}
          className="pointer-events-none block h-full w-full select-none object-contain"
          draggable={false}
          onDragStart={preventNativeMediaDrag}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            onMediaLayoutRef.current?.({
              kind: 'intrinsicAspectRatio',
              aspectRatio: getIntrinsicAspectRatio(naturalWidth, naturalHeight),
            })
          }}
        />
      )
    case 'video':
      return (
        <VideoEmbedPlayer
          sourceUrl={sanitizedSourceUrl}
          label={label}
          onMediaLayoutRef={onMediaLayoutRef}
        />
      )
    case 'audio':
      return (
        <AudioEmbedPlayer
          sourceUrl={sanitizedSourceUrl}
          label={label}
          onMediaLayoutRef={onMediaLayoutRef}
        />
      )
    case 'pdf':
      return (
        <ClientOnly fallback={pdfFallback}>
          <Suspense fallback={pdfFallback}>
            <LazyPdfFileViewer
              pdfUrl={sanitizedSourceUrl}
              onFirstPageAspectRatio={(aspectRatio) => {
                onMediaLayoutRef.current?.({ kind: 'intrinsicAspectRatio', aspectRatio })
              }}
            />
          </Suspense>
        </ClientOnly>
      )
    case 'unknown':
      return renderUnknown()
  }
}

function VideoEmbedPlayer({
  sourceUrl,
  label,
  onMediaLayoutRef,
}: {
  sourceUrl: string
  label: string
  onMediaLayoutRef: MutableRefObject<EmbedMediaLayoutReporter | undefined>
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  return (
    <div ref={rootRef} data-testid="video-embed-player" className="relative h-full w-full">
      <video
        ref={videoRef}
        src={sourceUrl}
        className="block h-full w-full"
        aria-label={label}
        draggable={false}
        onLoadedMetadata={(event) => {
          const { videoWidth, videoHeight } = event.currentTarget
          onMediaLayoutRef.current?.({
            kind: 'intrinsicAspectRatio',
            aspectRatio: getIntrinsicAspectRatio(videoWidth, videoHeight),
          })
        }}
      >
        <track kind="captions" label="Captions unavailable" />
      </video>
      <CustomMediaControls
        mediaRef={videoRef}
        fullscreenTargetRef={rootRef}
        label={label}
        className="absolute inset-x-0 bottom-0 bg-background/90"
      />
    </div>
  )
}

function AudioEmbedPlayer({
  sourceUrl,
  label,
  onMediaLayoutRef,
}: {
  sourceUrl: string
  label: string
  onMediaLayoutRef: MutableRefObject<EmbedMediaLayoutReporter | undefined>
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const reportRenderedHeight = () => {
    const renderedHeight = rootRef.current?.getBoundingClientRect().height ?? 0
    onMediaLayoutRef.current?.({
      kind: 'fixedHeight',
      height: getAudioEmbedLayoutHeight(renderedHeight),
    })
  }

  useLayoutEffect(() => {
    reportRenderedHeight()

    const root = rootRef.current
    if (!root || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(reportRenderedHeight)
    observer.observe(root)
    return () => observer.disconnect()
  })

  return (
    <div ref={rootRef} data-testid="audio-embed-player" className="w-full">
      <audio
        ref={audioRef}
        src={sourceUrl}
        className="hidden"
        aria-label={label}
        draggable={false}
        onLoadedMetadata={reportRenderedHeight}
      >
        <track kind="captions" label="Captions unavailable" />
      </audio>
      <CustomMediaControls mediaRef={audioRef} label={label} />
    </div>
  )
}

function CustomMediaControls({
  mediaRef,
  fullscreenTargetRef,
  label,
  className,
}: {
  mediaRef: RefObject<HTMLMediaElement | null>
  fullscreenTargetRef?: RefObject<HTMLElement | null>
  label: string
  className?: string
}) {
  const [state, dispatch] = useReducer(mediaControlsReducer, initialMediaControlsState)

  useEffect(() => {
    const media = mediaRef.current
    if (!media) return

    const sync = () => {
      dispatch({ type: 'sync', state: getMediaControlsState(media) })
    }

    sync()
    media.addEventListener('play', sync)
    media.addEventListener('pause', sync)
    media.addEventListener('timeupdate', sync)
    media.addEventListener('loadedmetadata', sync)
    media.addEventListener('volumechange', sync)
    media.addEventListener('durationchange', sync)
    return () => {
      media.removeEventListener('play', sync)
      media.removeEventListener('pause', sync)
      media.removeEventListener('timeupdate', sync)
      media.removeEventListener('loadedmetadata', sync)
      media.removeEventListener('volumechange', sync)
      media.removeEventListener('durationchange', sync)
    }
  }, [mediaRef])

  const togglePlayback = () => {
    const media = mediaRef.current
    if (!media) return
    if (!state.playing) {
      dispatch({ type: 'playing', playing: true })
      void media.play()
      return
    }
    dispatch({ type: 'playing', playing: false })
    media.pause()
  }

  const toggleMuted = () => {
    const media = mediaRef.current
    if (!media) return
    media.muted = !media.muted
    dispatch({ type: 'sync', state: getMediaControlsState(media) })
  }

  const updateCurrentTime = (value: string) => {
    const media = mediaRef.current
    if (!media) return
    const nextTime = Number(value)
    if (!Number.isFinite(nextTime)) return
    media.currentTime = nextTime
    dispatch({ type: 'currentTime', currentTime: nextTime })
  }

  const updateVolume = (value: string) => {
    const media = mediaRef.current
    if (!media) return
    const nextVolume = Number(value)
    if (!Number.isFinite(nextVolume)) return
    media.volume = Math.min(Math.max(nextVolume, 0), 1)
    media.muted = media.volume === 0 ? true : media.muted
    dispatch({ type: 'sync', state: getMediaControlsState(media) })
  }

  const enterFullscreen = () => {
    void fullscreenTargetRef?.current?.requestFullscreen?.()
  }

  return (
    <div
      data-testid="custom-media-controls"
      className={cn(
        'flex h-10 w-full select-none items-center gap-2 border-t border-border px-2 text-xs text-foreground',
        className,
      )}
      draggable={false}
    >
      <button
        type="button"
        aria-label={`${state.playing ? 'Pause' : 'Play'} ${label}`}
        className="inline-flex size-7 shrink-0 items-center justify-center border border-border bg-background text-foreground hover:bg-muted"
        draggable={false}
        data-embed-media-control="true"
        onPointerDown={stopControlPointerEvent}
        onDragStart={preventNativeMediaDrag}
        onClick={togglePlayback}
      >
        {state.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <span className="w-16 select-none tabular-nums text-muted-foreground">
        {formatMediaTime(state.currentTime)} / {formatMediaTime(state.duration)}
      </span>
      <input
        type="range"
        aria-label={`Seek ${label}`}
        className="min-w-0 flex-1"
        min={0}
        max={state.duration || 0}
        step={0.1}
        value={Math.min(state.currentTime, state.duration || state.currentTime)}
        draggable={false}
        data-embed-media-control="true"
        onPointerDown={stopControlPointerEvent}
        onDragStart={preventNativeMediaDrag}
        onChange={(event) => updateCurrentTime(event.currentTarget.value)}
      />
      <button
        type="button"
        aria-label={`${state.muted ? 'Unmute' : 'Mute'} ${label}`}
        className="inline-flex size-7 shrink-0 items-center justify-center border border-border bg-background text-foreground hover:bg-muted"
        draggable={false}
        data-embed-media-control="true"
        onPointerDown={stopControlPointerEvent}
        onDragStart={preventNativeMediaDrag}
        onClick={toggleMuted}
      >
        {state.muted || state.volume === 0 ? (
          <VolumeX className="size-4" />
        ) : (
          <Volume2 className="size-4" />
        )}
      </button>
      <input
        type="range"
        aria-label={`Volume ${label}`}
        className="w-20"
        min={0}
        max={1}
        step={0.05}
        value={state.muted ? 0 : state.volume}
        draggable={false}
        data-embed-media-control="true"
        onPointerDown={stopControlPointerEvent}
        onDragStart={preventNativeMediaDrag}
        onChange={(event) => updateVolume(event.currentTarget.value)}
      />
      {fullscreenTargetRef ? (
        <button
          type="button"
          aria-label="Enter fullscreen"
          className="inline-flex size-7 shrink-0 items-center justify-center border border-border bg-background text-foreground hover:bg-muted"
          draggable={false}
          data-embed-media-control="true"
          onPointerDown={stopControlPointerEvent}
          onDragStart={preventNativeMediaDrag}
          onClick={enterFullscreen}
        >
          <Maximize2 className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

function stopControlPointerEvent(event: ReactPointerEvent<HTMLElement>) {
  event.stopPropagation()
}

function mediaControlsReducer(
  state: MediaControlsState,
  action: MediaControlsAction,
): MediaControlsState {
  switch (action.type) {
    case 'sync':
      return action.state
    case 'playing':
      return { ...state, playing: action.playing }
    case 'currentTime':
      return { ...state, currentTime: action.currentTime }
  }
}

function getMediaControlsState(media: HTMLMediaElement): MediaControlsState {
  return {
    playing: !media.paused,
    muted: media.muted,
    volume: media.volume,
    currentTime: getFiniteMediaTime(media.currentTime),
    duration: getFiniteMediaTime(media.duration),
  }
}

function formatMediaTime(value: number) {
  const totalSeconds = Math.floor(getFiniteMediaTime(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getFiniteMediaTime(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function preventNativeMediaDrag(event: ReactDragEvent<HTMLElement>) {
  event.preventDefault()
}

function getAudioEmbedLayoutHeight(renderedHeight: number) {
  return Number.isFinite(renderedHeight) && renderedHeight > 0
    ? Math.ceil(renderedHeight)
    : AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK
}

function sanitizeMediaSourceUrl(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl)
    if (url.protocol === 'blob:') return url.href
    if (url.protocol !== 'https:') return null
    if (isBlockedBrowserMediaHost(url.hostname)) return null
    return url.href
  } catch {
    return null
  }
}

function isBlockedBrowserMediaHost(hostname: string) {
  const normalized = hostname.toLowerCase()
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    isPrivateIpv4Host(normalized)
  )
}

function isPrivateIpv4Host(hostname: string) {
  const octets = hostname.split('.').map((part) => Number(part))
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false
  }
  const [first = 0, second = 0] = octets
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  )
}
