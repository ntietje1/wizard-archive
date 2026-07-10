import type { LucideIcon } from 'lucide-react'
import type { FileUploadControl } from './control'
import { FileUploadSection } from './section'

export function FileUploadEmptyState({
  fileUpload,
  icon: Icon,
  title,
  description,
  isSubmitting,
  acceptPattern,
  dragDropText,
  ariaLabel,
}: {
  fileUpload: FileUploadControl
  icon: LucideIcon
  title: string
  description: string
  isSubmitting: boolean
  acceptPattern: string
  dragDropText: string
  ariaLabel?: string
}) {
  return (
    <section
      aria-label={ariaLabel ?? `${title} drop zone`}
      className="w-full h-full flex items-center justify-center p-8"
      onDragEnter={fileUpload.handleDrag}
      onDragEnd={fileUpload.handleDrag}
      onDragLeave={fileUpload.handleDrag}
      onDragOver={fileUpload.handleDrag}
      onDrop={fileUpload.handleDrop}
    >
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Icon className="size-10 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-4">
          <FileUploadSection
            fileUpload={fileUpload}
            isSubmitting={isSubmitting}
            acceptPattern={acceptPattern}
            dragDropText={dragDropText}
          />

          {fileUpload.uploadError && (
            <p className="text-sm text-destructive text-center">{fileUpload.uploadError}</p>
          )}
        </div>
      </div>
    </section>
  )
}
