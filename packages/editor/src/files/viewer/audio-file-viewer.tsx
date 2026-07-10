import { InvalidFileUrlMessage } from './invalid-file-url-message'
import { getValidMediaFileSource } from './media-file-source'
import type { MediaCaptionsTrackSource } from './media-captions-track'
import type { ValidMediaFileSource } from './media-file-source'
import { useState } from 'react'

interface AudioFileViewerProps {
  allowDataUrl?: boolean
  allowObjectUrl?: boolean
  audioUrl: string
  captions?: MediaCaptionsTrackSource
}

export function AudioFileViewer({
  allowDataUrl = false,
  allowObjectUrl = false,
  audioUrl,
  captions,
}: AudioFileViewerProps) {
  const mediaSource = getValidMediaFileSource({
    allowDataUrl,
    allowObjectUrl,
    captions,
    sourceUrl: audioUrl,
  })
  if (!mediaSource) {
    return <InvalidFileUrlMessage fileType="Audio" />
  }

  const { captionsTrack } = mediaSource

  return <AudioFileViewerContent key={audioUrl} audioUrl={audioUrl} captionsTrack={captionsTrack} />
}

function AudioFileViewerContent({
  audioUrl,
  captionsTrack,
}: {
  audioUrl: string
  captionsTrack: ValidMediaFileSource['captionsTrack']
}) {
  const [loadFailed, setLoadFailed] = useState(false)

  return (
    <div className="relative w-full h-full min-h-0 bg-background overflow-auto flex flex-col">
      <div className="flex-1 relative min-h-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl flex flex-col items-center gap-4">
          <div className="w-24 h-24 bg-accent rounded-lg flex items-center justify-center">
            <svg
              className="w-12 h-12 text-primary"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
            </svg>
          </div>
          {loadFailed ? (
            <p className="text-sm text-destructive" role="alert">
              Failed to load audio
            </p>
          ) : null}
          <audio src={audioUrl} controls className="w-full" onError={() => setLoadFailed(true)}>
            <track
              kind="captions"
              src={captionsTrack.source.src}
              srcLang={captionsTrack.source.srcLang}
              label={captionsTrack.source.label}
            />
            Your browser does not support the audio tag.
          </audio>
          {captionsTrack.status === 'unavailable' ? (
            <p className="text-sm text-muted-foreground">Captions unavailable</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
