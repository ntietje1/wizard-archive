import { FileUploadSection } from './file-upload-section'
import type { UseFileWithPreviewReturn } from '~/hooks/useFileWithPreview'

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
      dragDropText="Drag an image here or click to browse"
    />
  )
}
