import type { UseFileWithPreviewReturn } from '~/hooks/useFileWithPreview'
import { FileUploadSection } from './file-upload-section'

interface ImageUploadSectionProps {
  label?: string
  fileUpload: UseFileWithPreviewReturn
  handleFileSelect: (file: File) => void
  isSubmitting: boolean
}

export function ImageUploadSection({
  label,
  fileUpload,
  handleFileSelect,
  isSubmitting,
}: ImageUploadSectionProps) {
  return (
    <FileUploadSection
      label={label}
      fileUpload={fileUpload}
      handleFileSelect={handleFileSelect}
      isSubmitting={isSubmitting}
      acceptPattern="image/*"
      fileTypeLabel="PNG, JPG or GIF"
      maxSizeLabel="Max 5MB"
      dragDropText="Drag an image here or click to browse"
      renderPreview={(url) => (
        <img src={url} alt="Preview" className="w-full h-full object-cover" />
      )}
      renderPreviewDialog={(url, onClose) => (
        <img
          src={url}
          alt="Full preview"
          className="w-full h-auto max-h-[90vh] object-contain cursor-pointer"
          onClick={() => onClose()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
          }}
        />
      )}
    />
  )
}
