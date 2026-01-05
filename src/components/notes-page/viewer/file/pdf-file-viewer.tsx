import { useEffect, useState } from 'react'
import { isValidFileUrl } from '~/lib/file-url-validation'

interface PdfFileViewerProps {
  pdfUrl: string
  title: string
}

export function PdfFileViewer({ pdfUrl, title }: PdfFileViewerProps) {
  const [isValid, setIsValid] = useState(false)

  useEffect(() => {
    setIsValid(isValidFileUrl(pdfUrl))
  }, [pdfUrl])

  if (!isValid) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center p-4">
          <p className="text-lg font-medium text-red-500">Invalid PDF URL</p>
          <p className="text-sm mt-2">
            The PDF URL does not meet security requirements.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full min-h-0 bg-background overflow-auto flex flex-col">
      <div className="flex-1 relative min-h-0">
        <iframe
          src={pdfUrl}
          className="w-full h-full min-h-[600px] border-0"
          sandbox="allow-scripts allow-same-origin"
          title={title}
        />
      </div>
    </div>
  )
}
