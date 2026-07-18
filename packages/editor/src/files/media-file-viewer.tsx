import { Music, Video } from 'lucide-react'
import { useState } from 'react'

const UNAVAILABLE_CAPTIONS = `data:text/vtt;charset=utf-8,${encodeURIComponent(
  ['WEBVTT', '', '00:00:00.000 --> 99:59:59.000', 'Captions are not available.', ''].join('\n'),
)}`

export function MediaFileViewer({ kind, url }: { kind: 'audio' | 'video'; url: string }) {
  const [failed, setFailed] = useState(false)
  const Icon = kind === 'audio' ? Music : Video
  const label = kind === 'audio' ? 'audio' : 'video'

  const player =
    kind === 'audio' ? (
      <audio className="w-full max-w-2xl" controls src={url} onError={() => setFailed(true)}>
        <track
          default
          kind="captions"
          label="Captions unavailable"
          src={UNAVAILABLE_CAPTIONS}
          srcLang="en"
        />
        Your browser does not support audio playback.
      </audio>
    ) : (
      <video className="max-h-full max-w-full" controls src={url} onError={() => setFailed(true)}>
        <track
          default
          kind="captions"
          label="Captions unavailable"
          src={UNAVAILABLE_CAPTIONS}
          srcLang="en"
        />
        Your browser does not support video playback.
      </video>
    )

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-auto bg-background p-4">
      <Icon className="size-16 text-muted-foreground" aria-hidden="true" />
      {failed && (
        <p className="text-sm text-destructive" role="alert">
          Failed to load {label}
        </p>
      )}
      {player}
      <p className="text-sm text-muted-foreground">Captions unavailable</p>
    </div>
  )
}
