import { useEffect, useState } from 'react'
import { isValidFileUrl } from '~/lib/file-url-validation'

interface VideoFileViewerProps {
  videoUrl: string
}

export function VideoFileViewer({ videoUrl }: VideoFileViewerProps) {
  const [isValid, setIsValid] = useState(false)

  useEffect(() => {
    setIsValid(isValidFileUrl(videoUrl))
  }, [videoUrl])

  if (!isValid) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center p-4">
          <p className="text-lg font-medium text-red-500">Invalid Video URL</p>
          <p className="text-sm mt-2">
            The video URL does not meet security requirements.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full min-h-0 bg-background overflow-auto flex flex-col">
      <div className="flex-1 relative min-h-0 flex items-center justify-center p-4">
        <video src={videoUrl} controls className="max-w-full max-h-full">
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  )
}
