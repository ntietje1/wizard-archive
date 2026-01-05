import { useEffect, useState } from 'react'
import { isValidFileUrl } from '~/lib/file-url-validation'

interface AudioFileViewerProps {
  audioUrl: string
}

export function AudioFileViewer({ audioUrl }: AudioFileViewerProps) {
  const [isValid, setIsValid] = useState(false)

  useEffect(() => {
    setIsValid(isValidFileUrl(audioUrl))
  }, [audioUrl])

  if (!isValid) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center p-4">
          <p className="text-lg font-medium text-red-500">Invalid Audio URL</p>
          <p className="text-sm mt-2">
            The audio URL does not meet security requirements.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full min-h-0 bg-background overflow-auto flex flex-col">
      <div className="flex-1 relative min-h-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl flex flex-col items-center gap-4">
          <div className="w-24 h-24 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg
              className="w-12 h-12 text-blue-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
            </svg>
          </div>
          <audio src={audioUrl} controls className="w-full">
            Your browser does not support the audio tag.
          </audio>
        </div>
      </div>
    </div>
  )
}
