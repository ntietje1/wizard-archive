import { useEffect, useState } from 'react'

interface PdfFileViewerProps {
  pdfUrl: string
  title: string
}

// Validate PDF URL before rendering
function isValidPdfUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const convexUrl = (import.meta as any).env.VITE_CONVEX_URL

    // Must use HTTPS
    if (parsed.protocol !== 'https:') {
      return false
    }

    try {
      const convexParsed = new URL(convexUrl)
      // Check if origin matches Convex deployment
      if (parsed.origin !== convexParsed.origin) {
        return false
      }
      // Check if path matches storage pattern: /api/storage/[storageId]
      const storagePathPattern = /^\/api\/storage\/[^/]+$/
      if (!storagePathPattern.test(parsed.pathname)) {
        return false
      }
    } catch {
      // If Convex URL is invalid, fall back to basic validation
      return false
    }

    return true
  } catch {
    return false
  }
}

export function PdfFileViewer({ pdfUrl, title }: PdfFileViewerProps) {
  const [isValid, setIsValid] = useState(false)

  useEffect(() => {
    setIsValid(isValidPdfUrl(pdfUrl))
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
