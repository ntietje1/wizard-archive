import type { UseFileWithPreviewReturn } from '~/hooks/useFileWithPreview'
import { FileUploadSection } from './file-upload-section'
import { useState } from 'react'

interface PdfPreviewProps {
  previewUrl: string
}

function PdfPreview({ previewUrl: _previewUrl }: PdfPreviewProps) {
  const fileName = 'document.pdf'

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4">
      <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
        <svg
          className="w-8 h-8 text-red-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
          <path
            fillRule="evenodd"
            d="M4 2a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V2zm10 0H6v12h8V2z"
          />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{fileName}</p>
        <p className="text-xs text-muted-foreground">PDF Document</p>
      </div>
    </div>
  )
}

function PdfPreviewDialog({
  previewUrl,
  onClose,
}: PdfPreviewProps & { onClose: () => void }) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = () => {
    setIsDownloading(true)
    const link = document.createElement('a')
    link.href = previewUrl
    link.download = 'document.pdf'
    link.click()
    setIsDownloading(false)
    onClose()
  }

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-6 p-8"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 bg-red-100 rounded-lg flex items-center justify-center">
          <svg
            className="w-10 h-10 text-red-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
            <path
              fillRule="evenodd"
              d="M4 2a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V2zm10 0H6v12h8V2z"
            />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            PDF Document Selected
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Click the button below to download and view the PDF file in your
            default PDF reader.
          </p>
        </div>
      </div>

      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isDownloading ? 'Downloading...' : 'Download PDF'}
      </button>

      <p className="text-xs text-muted-foreground text-center">
        Click anywhere or press Escape to close
      </p>
    </div>
  )
}

interface PdfUploadSectionProps {
  label?: string
  fileUpload: UseFileWithPreviewReturn
  handleFileSelect: (file: File) => void
  isSubmitting: boolean
}

export function PdfUploadSection({
  label,
  fileUpload,
  handleFileSelect,
  isSubmitting,
}: PdfUploadSectionProps) {
  return (
    <FileUploadSection
      label={label}
      fileUpload={fileUpload}
      handleFileSelect={handleFileSelect}
      isSubmitting={isSubmitting}
      acceptPattern=".pdf,application/pdf"
      fileTypeLabel="PDF only"
      maxSizeLabel="Max 10MB"
      dragDropText="Drag a PDF here or click to browse"
      renderPreview={(url) => <PdfPreview previewUrl={url} />}
      renderPreviewDialog={(url, onClose) => (
        <PdfPreviewDialog previewUrl={url} onClose={onClose} />
      )}
    />
  )
}
