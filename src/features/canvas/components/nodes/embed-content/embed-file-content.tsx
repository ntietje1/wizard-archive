import { File, FileAudio, FileText, FileVideo } from 'lucide-react'

export function EmbedFileContent({
  downloadUrl,
  contentType,
}: {
  downloadUrl: string | null
  contentType: string | null
}) {
  if (!downloadUrl) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
        <File className="h-6 w-6" />
      </div>
    )
  }

  if (contentType?.startsWith('image/')) {
    return (
      <div className="h-full w-full overflow-hidden">
        <img
          src={downloadUrl}
          alt=""
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>
    )
  }

  const Icon = getFileTypeIcon(contentType)

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
      <Icon className="h-6 w-6" />
    </div>
  )
}

function getFileTypeIcon(contentType: string | null) {
  if (contentType?.startsWith('video/')) return FileVideo
  if (contentType?.startsWith('audio/')) return FileAudio
  if (contentType === 'application/pdf') return FileText
  return File
}
