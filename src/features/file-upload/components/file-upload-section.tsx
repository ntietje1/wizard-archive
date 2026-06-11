import { File, FileText, Image, Music, Upload, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FileUploadControl } from '~/features/file-upload/file-upload-control'
import { Label } from '~/features/shadcn/components/label'
import { Button } from '~/features/shadcn/components/button'
import { Card, CardContent } from '~/features/shadcn/components/card'
import { Badge } from '~/features/shadcn/components/badge'
import { Progress } from '~/features/shadcn/components/progress'
import { cn } from '~/features/shadcn/lib/utils'

interface FileUploadSectionProps {
  label?: string
  fileUpload: FileUploadControl
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

  if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileName)) {
    return Image
  }
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return FileText
  }
  if (mimeType.startsWith('video/') || /\.(mp4|webm|ogg|mov|avi|wmv|flv)$/i.test(fileName)) {
    return Video
  }
  if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(fileName)) {
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

function getFileExtension(fileName: string | undefined | null): string | null {
  if (!fileName) return null
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1 || lastDot === fileName.length - 1) return null
  return fileName.slice(lastDot + 1).toUpperCase()
}

function FileUploadInput({
  fileUpload,
  acceptPattern,
  disabled,
  previewMode = false,
}: {
  fileUpload: FileUploadControl
  acceptPattern: string
  disabled: boolean
  previewMode?: boolean
}) {
  return (
    <input
      ref={fileUpload.fileInputRef}
      type="file"
      accept={acceptPattern}
      disabled={disabled}
      aria-label="Upload file"
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
          fileUpload.handleFileSelect(file)
        }
      }}
      className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed ${
        previewMode ? 'z-0' : ''
      }`}
      style={previewMode ? { pointerEvents: fileUpload.preview ? 'none' : 'auto' } : undefined}
    />
  )
}

function FileMetadataBadges({ fileName, fileSize }: { fileName?: string; fileSize: string }) {
  const extension = getFileExtension(fileName)

  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <Badge variant="secondary" className="text-xs shrink-0">
        {fileSize}
      </Badge>
      {extension ? (
        <Badge variant="secondary" className="text-xs font-mono shrink-0">
          {extension}
        </Badge>
      ) : null}
    </div>
  )
}

function FilePreviewUploadContent({
  fileUpload,
  fileName,
  fileSize,
  FileIcon,
  acceptPattern,
  disabled,
}: {
  fileUpload: FileUploadControl
  fileName?: string
  fileSize: string | null
  FileIcon: LucideIcon
  acceptPattern: string
  disabled: boolean
}) {
  return (
    <div
      onDragEnter={fileUpload.handleDrag}
      onDragLeave={fileUpload.handleDrag}
      onDragOver={fileUpload.handleDrag}
      onDrop={fileUpload.handleDrop}
      className="relative w-full h-full flex items-center gap-4 cursor-pointer"
    >
      <div className="flex-shrink-0">
        <div className="size-12 rounded-lg bg-muted flex items-center justify-center border border-border">
          <FileIcon className="size-6 text-muted-foreground" />
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-2 overflow-hidden">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{fileName}</p>
          {fileSize ? <FileMetadataBadges fileName={fileName} fileSize={fileSize} /> : null}
        </div>
        {fileUpload.isUploading && (
          <Progress value={fileUpload.uploadProgress.percentage} className="h-1.5" />
        )}
      </div>

      <div className="flex-shrink-0 relative z-20">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            fileUpload.fileInputRef.current?.click()
          }}
          disabled={disabled}
          className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-100 ease-out"
        >
          Replace
        </Button>
      </div>
      {fileUpload.preview && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            window.open(fileUpload.preview, '_blank')
          }}
          className="absolute inset-0 w-full h-full z-10 cursor-pointer bg-transparent border-none"
          aria-label="Open file preview"
        />
      )}
      <FileUploadInput
        fileUpload={fileUpload}
        acceptPattern={acceptPattern}
        disabled={disabled}
        previewMode
      />
    </div>
  )
}

function EmptyFileUploadContent({
  fileUpload,
  acceptPattern,
  disabled,
  dragDropText,
}: {
  fileUpload: FileUploadControl
  acceptPattern: string
  disabled: boolean
  dragDropText: string
}) {
  return (
    <div
      onDragEnter={fileUpload.handleDrag}
      onDragLeave={fileUpload.handleDrag}
      onDragOver={fileUpload.handleDrag}
      onDrop={fileUpload.handleDrop}
      className="relative w-full h-full flex items-center justify-center cursor-pointer"
    >
      <div className="text-center pointer-events-none">
        <div className="flex justify-center mb-3">
          <Upload className="size-6 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">{dragDropText}</p>
      </div>
      <FileUploadInput fileUpload={fileUpload} acceptPattern={acceptPattern} disabled={disabled} />
    </div>
  )
}

function uploadZoneClass({
  hasPreview,
  isDragActive,
  isBusy,
}: {
  hasPreview: boolean
  isDragActive: boolean
  isBusy: boolean
}) {
  return cn(
    'group w-full border-2',
    hasPreview
      ? isDragActive
        ? 'border-upload-zone-active-border bg-upload-zone-active'
        : 'border-border'
      : isDragActive
        ? 'border-upload-zone-active-border bg-upload-zone-active'
        : 'border-dashed border-upload-zone-border bg-upload-zone hover:border-upload-zone-hover-border',
    isBusy && 'opacity-60',
  )
}

export function FileUploadSection({
  label,
  fileUpload,
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
        className={uploadZoneClass({
          hasPreview: Boolean(fileUpload.preview),
          isDragActive: fileUpload.isDragActive,
          isBusy: fileUpload.isUploading || isSubmitting,
        })}
      >
        <CardContent className="p-3 h-20 flex items-center">
          {fileUpload.preview ? (
            <FilePreviewUploadContent
              fileUpload={fileUpload}
              fileName={fileName}
              fileSize={fileSize}
              FileIcon={FileIcon}
              acceptPattern={acceptPattern}
              disabled={fileUpload.isUploading || isSubmitting}
            />
          ) : (
            <EmptyFileUploadContent
              fileUpload={fileUpload}
              acceptPattern={acceptPattern}
              disabled={fileUpload.isUploading || isSubmitting}
              dragDropText={dragDropText}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
