import type { ReactNode } from 'react'
import { FileUploadSection } from '@wizard-archive/ui/file-upload/section'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'

interface SidebarItemUploadFieldProps {
  acceptPattern: string
  children?: ReactNode
  dragDropText: string
  isSubmitting: boolean
  label: string
  upload: FileUploadControl
}

export function SidebarItemUploadField({
  acceptPattern,
  children,
  dragDropText,
  isSubmitting,
  label,
  upload,
}: SidebarItemUploadFieldProps) {
  return (
    <div className="space-y-2">
      <FileUploadSection
        label={label}
        fileUpload={upload}
        isSubmitting={isSubmitting}
        acceptPattern={acceptPattern}
        dragDropText={dragDropText}
      />
      {children}
    </div>
  )
}
