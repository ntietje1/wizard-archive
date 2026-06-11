import { isValidFileUrl } from './file-url-validation'

const EMPTY_CAPTIONS_TRACK = 'data:text/vtt;charset=utf-8,WEBVTT%0A'

interface VideoFileViewerProps {
  allowObjectUrl?: boolean
  videoUrl: string
}

export function VideoFileViewer({ allowObjectUrl = false, videoUrl }: VideoFileViewerProps) {
  const isValid = isValidFileUrl(videoUrl, { allowObjectUrl })

  if (!isValid) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center p-4">
          <p className="text-lg font-medium text-destructive">Invalid Video URL</p>
          <p className="text-sm mt-2">The video URL does not meet security requirements.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full min-h-0 bg-background overflow-auto flex flex-col">
      <div className="flex-1 relative min-h-0 flex items-center justify-center p-4">
        <video src={videoUrl} controls className="max-w-full max-h-full">
          <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  )
}
