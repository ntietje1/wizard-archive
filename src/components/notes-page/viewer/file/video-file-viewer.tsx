interface VideoFileViewerProps {
  videoUrl: string
}

export function VideoFileViewer({ videoUrl }: VideoFileViewerProps) {
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

