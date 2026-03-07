import { isValidFileUrl } from '~/lib/file-url-validation'

interface OtherFileViewerProps {
  fileUrl: string
  fileName: string
}

export function OtherFileViewer({ fileUrl, fileName }: OtherFileViewerProps) {
  const isValid = isValidFileUrl(fileUrl)

  if (!isValid) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center p-4">
          <p className="text-lg font-medium text-destructive">Invalid File URL</p>
          <p className="text-sm mt-2">
            The file URL does not meet security requirements.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full min-h-0 bg-background overflow-auto flex flex-col">
      <div className="flex-1 relative min-h-0 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
            <svg
              className="w-12 h-12 text-muted-foreground"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium">{fileName || 'File'}</p>
            <p className="text-sm text-muted-foreground mt-2">
              This file type cannot be previewed
            </p>
          </div>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Open file in new tab
          </a>
        </div>
      </div>
    </div>
  )
}
