import { FileUploadSection } from './file-upload-section'
import type { UseFileWithPreviewReturn } from '~/features/file-upload/hooks/useFileWithPreview'
import { FILE_UPLOAD_ACCEPT_PATTERN } from 'convex/storage/validation'

interface GenericFileUploadSectionProps {
  label?: string
  fileUpload: UseFileWithPreviewReturn
  isSubmitting: boolean
}

export function GenericFileUploadSection({
  label,
  fileUpload,
  isSubmitting,
}: GenericFileUploadSectionProps) {
  return (
    <FileUploadSection
      label={label}
      fileUpload={fileUpload}
      isSubmitting={isSubmitting}
      acceptPattern={FILE_UPLOAD_ACCEPT_PATTERN}
      dragDropText="Drag a file here or click to browse"
    />
  )
}
