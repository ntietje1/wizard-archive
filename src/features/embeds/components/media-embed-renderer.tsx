import { ClientOnly } from '@tanstack/react-router'
import { Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Suspense, lazy, useEffect, useLayoutEffect, useReducer, useRef } from 'react'
import { Button, buttonVariants } from '~/features/shadcn/components/button'
import { Popover, PopoverContent } from '~/features/shadcn/components/popover'
import { cn } from '~/features/shadcn/lib/utils'
import { EmbedLoadingState } from './embed-loading-state'
import { AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK, getIntrinsicAspectRatio } from '../utils/embed-media'
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
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

const pdfFallback = <EmbedLoadingState label="Loading PDF" />

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

type MediaControlsUiState = {
  controlsWidth: number | null
  seekHoverPercent: number | null
  volumeHoverPercent: number | null
  volumePopoverOpen: boolean
}

type MediaControlsUiAction =
  | { type: 'resize'; controlsWidth: number }
  | { type: 'seekHover'; percent: number | null }
  | { type: 'volumeHover'; percent: number | null }
  | { type: 'setVolumePopover'; open: boolean }

const initialMediaControlsState: MediaControlsState = {
  playing: false,
  muted: false,
  volume: 1,
  currentTime: 0,
  duration: 0,
}

const initialMediaControlsUiState: MediaControlsUiState = {
  controlsWidth: null,
  seekHoverPercent: null,
  volumeHoverPercent: null,
  volumePopoverOpen: false,
}

const COMPACT_TIMELINE_WIDTH_PX = 140
const COMPACT_VOLUME_WIDTH_PX = 380
const COMPACT_TIME_WIDTH_PX = 220

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

  useLayoutEffect(() => {
    const reportRenderedHeight = () => {
      reportAudioEmbedRenderedHeight(rootRef.current, onMediaLayoutRef)
    }

    reportRenderedHeight()

    const root = rootRef.current
    if (!root || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(reportRenderedHeight)
    observer.observe(root)
    return () => observer.disconnect()
  }, [onMediaLayoutRef, sourceUrl])

  return (
    <div ref={rootRef} data-testid="audio-embed-player" className="w-full">
      <audio
        ref={audioRef}
        src={sourceUrl}
        className="hidden"
        aria-label={label}
        draggable={false}
        onLoadedMetadata={() => {
          reportAudioEmbedRenderedHeight(rootRef.current, onMediaLayoutRef)
        }}
      >
        <track kind="captions" label="Captions unavailable" />
      </audio>
      <CustomMediaControls mediaRef={audioRef} label={label} />
    </div>
  )
}

function reportAudioEmbedRenderedHeight(
  root: HTMLElement | null,
  onMediaLayoutRef: MutableRefObject<EmbedMediaLayoutReporter | undefined>,
) {
  const renderedHeight = root?.getBoundingClientRect().height ?? 0
  onMediaLayoutRef.current?.({
    kind: 'fixedHeight',
    height: getAudioEmbedLayoutHeight(renderedHeight),
  })
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
  const controlsRef = useRef<HTMLDivElement | null>(null)
  const [state, dispatch] = useReducer(mediaControlsReducer, initialMediaControlsState)
  const [uiState, dispatchUi] = useReducer(mediaControlsUiReducer, initialMediaControlsUiState)

  useLayoutEffect(() => {
    const controls = controlsRef.current
    if (!controls || typeof ResizeObserver === 'undefined') return undefined

    const updateControlsWidth = () => {
      dispatchUi({
        type: 'resize',
        controlsWidth: controls.getBoundingClientRect().width,
      })
    }

    updateControlsWidth()
    const observer = new ResizeObserver((entries) => {
      const [entry] = entries
      const width = entry?.contentRect.width ?? controls.getBoundingClientRect().width
      dispatchUi({ type: 'resize', controlsWidth: width })
    })
    observer.observe(controls)
    return () => observer.disconnect()
  }, [])

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

  const handleVolumeButtonClick = () => {
    toggleMuted()
  }

  const enterFullscreen = () => {
    void fullscreenTargetRef?.current?.requestFullscreen?.()
  }

  const duration = state.duration || 0
  const currentTime = Math.min(state.currentTime, duration || state.currentTime)
  const volume = state.muted ? 0 : state.volume
  const compactTimeline = isCompactTimeline(uiState.controlsWidth)
  const compactTime = isCompactTime(uiState.controlsWidth)
  const compactVolume = isCompactVolume(uiState.controlsWidth)

  return (
    <div
      ref={controlsRef}
      data-testid="custom-media-controls"
      className={cn(
        'relative flex h-10 w-full select-none items-center gap-2 px-2 text-xs text-foreground',
        className,
      )}
      draggable={false}
    >
      <PlayPauseButton label={label} playing={state.playing} onClick={togglePlayback} />
      {compactTime ? null : <MediaTime currentTime={currentTime} duration={duration} />}
      {compactTimeline ? null : (
        <SeekSlider
          label={label}
          currentTime={currentTime}
          duration={duration}
          hoverPercent={uiState.seekHoverPercent}
          onHoverPercent={(percent) => dispatchUi({ type: 'seekHover', percent })}
          onChange={updateCurrentTime}
        />
      )}
      <div
        data-testid="media-control-trailing-controls"
        className="ml-auto flex shrink-0 items-center gap-1"
      >
        <MediaVolumeControls
          compact={compactVolume}
          hoverPercent={uiState.volumeHoverPercent}
          label={label}
          muted={state.muted}
          popoverOpen={uiState.volumePopoverOpen}
          value={volume}
          onChange={updateVolume}
          onClosePopover={() => dispatchUi({ type: 'setVolumePopover', open: false })}
          onHoverPercent={(percent) => dispatchUi({ type: 'volumeHover', percent })}
          onMuteClick={handleVolumeButtonClick}
          onTogglePopover={() =>
            dispatchUi({ type: 'setVolumePopover', open: !uiState.volumePopoverOpen })
          }
        />
        {fullscreenTargetRef ? <FullscreenButton onClick={enterFullscreen} /> : null}
      </div>
    </div>
  )
}

function PlayPauseButton({
  label,
  onClick,
  playing,
}: {
  label: string
  onClick: () => void
  playing: boolean
}) {
  return (
    <Button
      type="button"
      aria-label={`${playing ? 'Pause' : 'Play'} ${label}`}
      variant="ghost"
      size="icon-sm"
      className="media-control-button"
      draggable={false}
      data-embed-media-control="true"
      onPointerDown={stopControlPointerEvent}
      onDragStart={preventNativeMediaDrag}
      onClick={onClick}
    >
      {playing ? (
        <Pause className="media-control-icon size-4" />
      ) : (
        <Play className="media-control-icon size-4" />
      )}
    </Button>
  )
}

function MediaTime({ currentTime, duration }: { currentTime: number; duration: number }) {
  return (
    <span className="shrink-0 select-none whitespace-nowrap tabular-nums text-muted-foreground">
      {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
    </span>
  )
}

function SeekSlider({
  currentTime,
  duration,
  hoverPercent,
  label,
  onChange,
  onHoverPercent,
}: {
  currentTime: number
  duration: number
  hoverPercent: number | null
  label: string
  onChange: (value: string) => void
  onHoverPercent: (percent: number | null) => void
}) {
  return (
    <input
      type="range"
      aria-label={`Seek ${label}`}
      className="media-control-slider media-control-timeline min-w-12 flex-1"
      min={0}
      max={duration}
      step={0.1}
      value={currentTime}
      draggable={false}
      data-embed-media-control="true"
      style={getSliderStyle(getMediaSliderPercent(currentTime, 0, duration), hoverPercent)}
      onPointerDown={stopControlPointerEvent}
      onPointerMove={(event) => onHoverPercent(getSliderPointerPercent(event))}
      onPointerLeave={() => onHoverPercent(null)}
      onDragStart={preventNativeMediaDrag}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  )
}

function MediaVolumeControls({
  compact,
  hoverPercent,
  label,
  muted,
  onChange,
  onClosePopover,
  onHoverPercent,
  onMuteClick,
  onTogglePopover,
  popoverOpen,
  value,
}: {
  compact: boolean
  hoverPercent: number | null
  label: string
  muted: boolean
  onChange: (value: string) => void
  onClosePopover: () => void
  onHoverPercent: (percent: number | null) => void
  onMuteClick: () => void
  onTogglePopover: () => void
  popoverOpen: boolean
  value: number
}) {
  const compactVolumeButtonRef = useRef<HTMLButtonElement | null>(null)
  const suppressCompactVolumeClickRef = useRef(false)

  if (compact) {
    return (
      <Popover modal={false} open={popoverOpen} onOpenChange={(open) => !open && onClosePopover()}>
        <button
          ref={compactVolumeButtonRef}
          type="button"
          aria-label={`Adjust volume ${label}`}
          aria-expanded={popoverOpen}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
            'media-control-button',
          )}
          draggable={false}
          data-embed-media-control="true"
          onPointerDown={(event) => {
            stopFocusableControlPointerEvent(event)
            if (!popoverOpen) return
            suppressCompactVolumeClickRef.current = true
            onClosePopover()
          }}
          onClick={(event) => {
            if (suppressCompactVolumeClickRef.current) {
              suppressCompactVolumeClickRef.current = false
              stopControlClickEvent(event)
              return
            }
            onTogglePopover()
            stopControlClickEvent(event)
          }}
          onDragStart={preventNativeMediaDrag}
        >
          <VolumeIcon muted={muted} value={value} />
        </button>
        <PopoverContent
          anchor={compactVolumeButtonRef}
          data-testid="compact-volume-slider"
          data-embed-media-control="true"
          positionMethod="fixed"
          side="bottom"
          align="center"
          sideOffset={6}
          className="w-auto rounded-sm !border-0 p-2 !outline-none !ring-0 focus:!outline-none focus:!ring-0 focus-visible:!outline-none focus-visible:!ring-0"
          onMouseLeave={onClosePopover}
          onPointerDown={stopControlPointerEvent}
          onDragStart={preventNativeMediaDrag}
        >
          <VolumeSlider
            orientation="vertical"
            label={label}
            value={value}
            hoverPercent={hoverPercent}
            className="h-24"
            onHoverPercent={onHoverPercent}
            onChange={onChange}
          />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <>
      <Button
        type="button"
        aria-label={`${muted ? 'Unmute' : 'Mute'} ${label}`}
        variant="ghost"
        size="icon-sm"
        className="media-control-button"
        draggable={false}
        data-embed-media-control="true"
        onPointerDown={stopControlPointerEvent}
        onDragStart={preventNativeMediaDrag}
        onClick={onMuteClick}
      >
        <VolumeIcon muted={muted} value={value} />
      </Button>
      <VolumeSlider
        label={label}
        value={value}
        hoverPercent={hoverPercent}
        className="w-20"
        onHoverPercent={onHoverPercent}
        onChange={onChange}
      />
    </>
  )
}

function VolumeIcon({ muted, value }: { muted: boolean; value: number }) {
  return muted || value === 0 ? (
    <VolumeX className="media-control-icon size-4" />
  ) : (
    <Volume2 className="media-control-icon size-4" />
  )
}

function FullscreenButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      aria-label="Enter fullscreen"
      variant="ghost"
      size="icon-sm"
      className="media-control-button"
      draggable={false}
      data-embed-media-control="true"
      onPointerDown={stopControlPointerEvent}
      onDragStart={preventNativeMediaDrag}
      onClick={onClick}
    >
      <Maximize2 className="media-control-icon size-4" />
    </Button>
  )
}

function stopControlPointerEvent(event: ReactPointerEvent<HTMLElement>) {
  event.stopPropagation()
}

function stopFocusableControlPointerEvent(event: ReactPointerEvent<HTMLElement>) {
  event.preventDefault()
  event.stopPropagation()
}

function stopControlClickEvent(event: ReactMouseEvent<HTMLElement>) {
  event.stopPropagation()
}

function VolumeSlider({
  label,
  value,
  hoverPercent,
  className,
  orientation = 'horizontal',
  onHoverPercent,
  onChange,
}: {
  label: string
  value: number
  hoverPercent: number | null
  className?: string
  orientation?: 'horizontal' | 'vertical'
  onHoverPercent: (percent: number | null) => void
  onChange: (value: string) => void
}) {
  return (
    <input
      type="range"
      aria-label={`Volume ${label}`}
      aria-orientation={orientation}
      className={cn(
        'media-control-slider',
        orientation === 'vertical' && 'media-control-slider-vertical',
        className,
      )}
      min={0}
      max={1}
      step={0.05}
      value={value}
      draggable={false}
      data-embed-media-control="true"
      style={getSliderStyle(getMediaSliderPercent(value, 0, 1), hoverPercent)}
      onPointerDown={stopControlPointerEvent}
      onPointerMove={(event) => onHoverPercent(getSliderPointerPercent(event, orientation))}
      onPointerLeave={() => onHoverPercent(null)}
      onDragStart={preventNativeMediaDrag}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  )
}

function mediaControlsReducer(
  state: MediaControlsState,
  action: MediaControlsAction,
): MediaControlsState {
  switch (action.type) {
    case 'sync':
      if (areMediaControlsStatesEqual(state, action.state)) return state
      return action.state
    case 'playing':
      if (state.playing === action.playing) return state
      return { ...state, playing: action.playing }
    case 'currentTime':
      if (state.currentTime === action.currentTime) return state
      return { ...state, currentTime: action.currentTime }
  }
}

function mediaControlsUiReducer(
  state: MediaControlsUiState,
  action: MediaControlsUiAction,
): MediaControlsUiState {
  switch (action.type) {
    case 'resize':
      if (state.controlsWidth === action.controlsWidth) return state
      return { ...state, controlsWidth: action.controlsWidth }
    case 'seekHover':
      if (state.seekHoverPercent === action.percent) return state
      return { ...state, seekHoverPercent: action.percent }
    case 'volumeHover':
      if (state.volumeHoverPercent === action.percent) return state
      return { ...state, volumeHoverPercent: action.percent }
    case 'setVolumePopover':
      if (state.volumePopoverOpen === action.open) return state
      return {
        ...state,
        volumePopoverOpen: action.open,
      }
  }
}

function areMediaControlsStatesEqual(state: MediaControlsState, nextState: MediaControlsState) {
  return (
    state.playing === nextState.playing &&
    state.muted === nextState.muted &&
    state.volume === nextState.volume &&
    state.currentTime === nextState.currentTime &&
    state.duration === nextState.duration
  )
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

function isCompactTimeline(width: number | null) {
  return width !== null && width < COMPACT_TIMELINE_WIDTH_PX
}

function isCompactTime(width: number | null) {
  return width !== null && width < COMPACT_TIME_WIDTH_PX
}

function isCompactVolume(width: number | null) {
  return width !== null && width < COMPACT_VOLUME_WIDTH_PX
}

function getMediaSliderPercent(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 0
  }

  return clampPercent(((value - min) / (max - min)) * 100)
}

function getSliderPointerPercent(
  event: ReactPointerEvent<HTMLInputElement>,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
) {
  const rect = event.currentTarget.getBoundingClientRect()
  if (orientation === 'vertical') {
    if (rect.height <= 0) return 0
    return clampPercent(((rect.bottom - event.clientY) / rect.height) * 100)
  }

  if (rect.width <= 0) return 0
  return clampPercent(((event.clientX - rect.left) / rect.width) * 100)
}

function getSliderStyle(valuePercent: number, hoverPercent: number | null): CSSProperties {
  const previewStart = hoverPercent === null ? valuePercent : Math.min(valuePercent, hoverPercent)
  const previewEnd = hoverPercent === null ? valuePercent : Math.max(valuePercent, hoverPercent)

  return {
    '--media-slider-value-percent': `${formatPercent(valuePercent)}%`,
    '--media-slider-hover-percent':
      hoverPercent === null ? `${formatPercent(valuePercent)}%` : `${formatPercent(hoverPercent)}%`,
    '--media-slider-primary-end': `${formatPercent(previewStart)}%`,
    '--media-slider-preview-start': `${formatPercent(previewStart)}%`,
    '--media-slider-preview-end': `${formatPercent(previewEnd)}%`,
  } as CSSProperties
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 100)
}

function formatPercent(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2)
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
