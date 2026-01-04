import { File, FileText, Image, Music, Upload, Video } from 'lucide-react'
import type { UseFileWithPreviewReturn } from '~/hooks/useFileWithPreview'
import { Label } from '~/components/shadcn/ui/label'
import { Button } from '~/components/shadcn/ui/button.tsx'
import { Card, CardContent } from '~/components/shadcn/ui/card'
import { Badge } from '~/components/shadcn/ui/badge'
import { Progress } from '~/components/shadcn/ui/progress'

export interface FileUploadSectionProps {
  label?: string
  fileUpload: UseFileWithPreviewReturn
  handleFileSelect: (file: File) => void
  isSubmitting: boolean
  acceptPattern: string
  dragDropText: string
}

function getFileTypeIcon(
  file: File | null,
  fileMetadata?: { name: string; type: string; size: number } | null,
) {
  let mimeType = ''
  let fileName = ''

  if (file) {
    mimeType = file.type.toLowerCase()
    fileName = file.name.toLowerCase()
  } else if (fileMetadata) {
    mimeType = fileMetadata.type.toLowerCase()
    fileName = fileMetadata.name.toLowerCase()
  }

  if (
    mimeType.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileName)
  ) {
    return Image
  }
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return FileText
  }
  if (
    mimeType.startsWith('video/') ||
    /\.(mp4|webm|ogg|mov|avi|wmv|flv)$/i.test(fileName)
  ) {
    return Video
  }
  if (
    mimeType.startsWith('audio/') ||
    /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(fileName)
  ) {
    return Music
  }
  return File
}

function formatFileSize(size: number): string {
  if (size > 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`
  }
  return `${(size / 1024).toFixed(2)} KB`
}

export function FileUploadSection({
  label,
  fileUpload,
  handleFileSelect,
  isSubmitting,
  acceptPattern,
  dragDropText,
}: FileUploadSectionProps) {
  const fileName = fileUpload.fileMetadata?.name ?? fileUpload.file?.name
  const fileSize = fileUpload.fileMetadata?.size
    ? formatFileSize(fileUpload.fileMetadata.size)
    : fileUpload.file?.size
      ? formatFileSize(fileUpload.file.size)
      : null
  const FileIcon = getFileTypeIcon(fileUpload.file, fileUpload.fileMetadata)

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-semibold pt-2">{label}</Label>}

      {/* File Card */}
      <Card
        className={`group w-full border-2 transition-all ${
          fileUpload.preview
            ? fileUpload.isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border'
            : fileUpload.isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-dashed border-muted-foreground/25 bg-muted/50 hover:border-muted-foreground/50'
        } ${fileUpload.isUploading || isSubmitting ? 'opacity-60' : ''}`}
      >
        <CardContent className="p-3 h-20 flex items-center">
          {fileUpload.preview ? (
            <div
              onDragEnter={fileUpload.handleDrag}
              onDragLeave={fileUpload.handleDrag}
              onDragOver={fileUpload.handleDrag}
              onDrop={fileUpload.handleDrop}
              className="relative w-full h-full flex items-center gap-4 cursor-pointer"
            >
              {/* File Icon */}
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border border-border">
                  <FileIcon className="w-6 h-6 text-muted-foreground" />
                </div>
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="font-medium text-sm truncate">{fileName}</p>
                  {fileSize && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-xs">
                        {fileSize}
                      </Badge>
                    </div>
                  )}
                </div>
                {/* Upload Progress */}
                {fileUpload.isUploading && (
                  <Progress
                    value={fileUpload.uploadProgress.percentage}
                    className="h-1.5"
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileUpload.fileInputRef.current?.click()
                  }}
                  disabled={fileUpload.isUploading || isSubmitting}
                  className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150"
                >
                  Replace
                </Button>
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
          ) : (
            <div
              onDragEnter={fileUpload.handleDrag}
              onDragLeave={fileUpload.handleDrag}
              onDragOver={fileUpload.handleDrag}
              onDrop={fileUpload.handleDrop}
              className="relative w-full h-full flex items-center justify-center cursor-pointer"
            >
              <div className="text-center pointer-events-none">
                <div className="flex justify-center mb-3">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {dragDropText}
                </p>
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
        </CardContent>
      </Card>
    </div>
  )
}
