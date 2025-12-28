import { Expand, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { ErrorAlert } from '../forms/category-tag-form/base-tag-form/error-alert'
import type { UseFileWithPreviewReturn } from '~/hooks/useFileWithPreview'
import type { ReactNode } from 'react'
import { Label } from '~/components/shadcn/ui/label'
import { Button } from '~/components/shadcn/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '~/components/shadcn/ui/dialog'

export interface FileUploadSectionProps {
  label?: string
  fileUpload: UseFileWithPreviewReturn
  handleFileSelect: (file: File) => void
  isSubmitting: boolean
  acceptPattern: string
  fileTypeLabel: string
  maxSizeLabel: string
  dragDropText: string
  renderPreview: (previewUrl: string) => ReactNode
  renderPreviewDialog: (previewUrl: string, onClose: () => void) => ReactNode
}

export function FileUploadSection({
  label,
  fileUpload,
  handleFileSelect,
  isSubmitting,
  acceptPattern,
  fileTypeLabel,
  maxSizeLabel,
  dragDropText,
  renderPreview,
  renderPreviewDialog,
}: FileUploadSectionProps) {
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-semibold pt-2">{label}</Label>}

      {/* File Preview / Drag & Drop Zone */}
      {fileUpload.preview ? (
        <div className="relative">
          <div className="relative group w-full h-40 rounded-lg overflow-hidden border-2 border-primary/20 bg-muted shadow-sm">
            {/* Custom preview component */}
            <div className="w-full h-full overflow-auto">
              {renderPreview(fileUpload.preview)}
            </div>

            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={fileUpload.removeFile}
                disabled={fileUpload.isUploading || isSubmitting}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} className="mr-1" />
                Remove
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsPreviewDialogOpen(true)}
                disabled={fileUpload.isUploading || isSubmitting}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Expand size={16} className="mr-1" />
                View
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={fileUpload.handleDrag}
          onDragLeave={fileUpload.handleDrag}
          onDragOver={fileUpload.handleDrag}
          onDrop={fileUpload.handleDrop}
          className={`relative w-full h-40 rounded-lg border-2 border-dashed transition-all ${
            fileUpload.isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 bg-muted/50 hover:border-muted-foreground/50'
          } ${fileUpload.isUploading || isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center pointer-events-none">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Upload size={24} className="text-primary" />
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">
                {dragDropText}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {fileTypeLabel} • {maxSizeLabel}
              </p>
            </div>
          </div>
          <input
            ref={fileUpload.fileInputRef}
            type="file"
            accept={acceptPattern}
            disabled={fileUpload.isUploading || isSubmitting}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0]
              if (file) {
                handleFileSelect(file)
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
        </div>
      )}

      {/* Upload Error */}
      <ErrorAlert
        error={fileUpload.uploadError}
        shouldShowError={!!fileUpload.uploadError}
      />

      {/* Upload Progress */}
      {fileUpload.isUploading && (
        <div className="space-y-2">
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{
                width: `${fileUpload.uploadProgress.percentage}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogTitle className="sr-only">File Preview</DialogTitle>
        <DialogDescription className="sr-only">
          Preview the selected file
        </DialogDescription>
        <DialogContent
          className="max-w-4xl w-full p-0 border-0 bg-black/90 [&>button]:hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {fileUpload.preview &&
            renderPreviewDialog(fileUpload.preview, () =>
              setIsPreviewDialogOpen(false),
            )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
