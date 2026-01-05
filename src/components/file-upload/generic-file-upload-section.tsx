import { FileUploadSection } from './file-upload-section'
import type { UseFileWithPreviewReturn } from '~/hooks/useFileWithPreview'

interface GenericFileUploadSectionProps {
  label?: string
  fileUpload: UseFileWithPreviewReturn
  handleFileSelect: (file: File) => void
  isSubmitting: boolean
}

export function GenericFileUploadSection({
  label,
  fileUpload,
  handleFileSelect,
  isSubmitting,
}: GenericFileUploadSectionProps) {
  return (
    <FileUploadSection
      label={label}
      fileUpload={fileUpload}
      handleFileSelect={handleFileSelect}
      isSubmitting={isSubmitting}
      acceptPattern="*/*"
      dragDropText="Drag a file here or click to browse"
    />
  )
}
