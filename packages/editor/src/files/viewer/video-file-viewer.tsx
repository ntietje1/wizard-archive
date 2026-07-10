import { InvalidFileUrlMessage } from './invalid-file-url-message'
import { getValidMediaFileSource } from './media-file-source'
import type { MediaCaptionsTrackSource } from './media-captions-track'
import type { ValidMediaFileSource } from './media-file-source'
import { useState } from 'react'

interface VideoFileViewerProps {
  allowDataUrl?: boolean
  allowObjectUrl?: boolean
  videoUrl: string
  captions?: MediaCaptionsTrackSource
}

export function VideoFileViewer({
  allowDataUrl = false,
  allowObjectUrl = false,
  videoUrl,
  captions,
}: VideoFileViewerProps) {
  const mediaSource = getValidMediaFileSource({
    allowDataUrl,
    allowObjectUrl,
    captions,
    sourceUrl: videoUrl,
  })
  if (!mediaSource) {
    return <InvalidFileUrlMessage fileType="Video" />
  }
  const { captionsTrack } = mediaSource

  return <VideoFileViewerContent key={videoUrl} videoUrl={videoUrl} captionsTrack={captionsTrack} />
}

function VideoFileViewerContent({
  videoUrl,
  captionsTrack,
}: {
  videoUrl: string
  captionsTrack: ValidMediaFileSource['captionsTrack']
}) {
  const [loadFailed, setLoadFailed] = useState(false)

  return (
    <div className="relative w-full h-full min-h-0 bg-background overflow-auto flex flex-col">
      <div className="flex-1 relative min-h-0 flex flex-col items-center justify-center gap-3 p-4">
        {loadFailed ? (
          <p className="text-sm text-destructive" role="alert">
            Failed to load video
          </p>
        ) : null}
        <video
          src={videoUrl}
          controls
          className="max-w-full max-h-full"
          onError={() => setLoadFailed(true)}
        >
          <track
            kind="captions"
            src={captionsTrack.source.src}
            srcLang={captionsTrack.source.srcLang}
            label={captionsTrack.source.label}
          />
          Your browser does not support the video tag.
        </video>
        {captionsTrack.status === 'unavailable' ? (
          <p className="text-sm text-muted-foreground">Captions unavailable</p>
        ) : null}
      </div>
    </div>
  )
}
