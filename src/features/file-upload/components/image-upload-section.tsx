import { FileUploadSection } from './file-upload-section'
import type { UseFileWithPreviewReturn } from '~/features/file-upload/hooks/useFileWithPreview'

interface ImageUploadSectionProps {
  label?: string
  fileUpload: UseFileWithPreviewReturn
  isSubmitting: boolean
}

export function ImageUploadSection({ label, fileUpload, isSubmitting }: ImageUploadSectionProps) {
  return (
    <FileUploadSection
      label={label}
      fileUpload={fileUpload}
      isSubmitting={isSubmitting}
      acceptPattern="image/*"
      dragDropText="Drag an image here or click to browse"
    />
  )
}
