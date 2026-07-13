import { AlertTriangle, Download, File, Upload } from 'lucide-react'
import {
  FILE_UPLOAD_ACCEPT_PATTERN,
  validateFileUpload,
} from '../../../../../shared/storage/validation'
import { FileUploadEmptyState } from '@wizard-archive/ui/file-upload/empty-state'
import { FileContentViewer } from './content-viewer'
import type { ResolvedFile } from '../session-contract'
import type { FileItemWithContent } from '../item-contract'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { buttonVariants } from '@wizard-archive/ui/shadcn/components/button-variants'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import type { ChangeEvent, RefObject } from 'react'
import { useRef, useState } from 'react'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'
import { createBrowserImportFile } from '../../filesystem/browser-import-file'
import { useFileDropControl } from '../use-file-drop-control'
import { isValidFileUrl } from './file-url-validation'
import type { FileViewerSource } from './source'
import { useResourceReplacementController } from '../../filesystem/resource-replacement'

type FileViewerProps = {
  item: FileItemWithContent
  source: FileViewerSource
}

type AvailableResolvedFile = Extract<ResolvedFile, { status: 'available' }>

export function FileViewer({ item: file, source }: FileViewerProps) {
  const resolvedFile = source.resolveFile(file)
  const canReplaceFile = source.canReplaceFile(file)

  if (resolvedFile.status === 'unattached') {
    return (
      <EmptyFileViewer key={file.id} file={file} canReplaceFile={canReplaceFile} source={source} />
    )
  }

  if (resolvedFile.status === 'unavailable') {
    return (
      <UnavailableFileViewer
        key={file.id}
        file={file}
        canReplaceFile={canReplaceFile}
        source={source}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
      <FileViewerHeader
        key={file.id}
        file={file}
        canReplaceFile={canReplaceFile}
        resolvedFile={resolvedFile}
        maxUploadBytes={source.maxUploadBytes}
        replaceFile={source.replaceFile}
      />
      <section className="min-h-0 flex-1" aria-label="File preview">
        <FileContentViewer
          key={resolvedFile.downloadUrl}
          allowDataUrl={resolvedFile.allowDataUrl === true}
          allowObjectUrl={resolvedFile.allowObjectUrl}
          downloadUrl={resolvedFile.downloadUrl}
          contentType={resolvedFile.contentType}
          name={resolvedFile.name}
        />
      </section>
    </div>
  )
}

function UnavailableFileViewer({
  canReplaceFile,
  file,
  source,
}: {
  canReplaceFile: boolean
  file: FileItemWithContent
  source: FileViewerSource
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { attemptFileReplacement, isReplacing, replacementError } = useFileReplacement({
    enabled: canReplaceFile,
    failureMessage: 'Failed to replace file',
    fileId: file.id,
    maxUploadBytes: source.maxUploadBytes,
    replaceFile: source.replaceFile,
    successMessage: 'File replaced',
  })

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) =>
    handleFileReplacementInputChange(event, attemptFileReplacement)

  return (
    <div className="flex h-full w-full items-center justify-center p-8 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">File unavailable</h2>
          <p className="text-sm text-muted-foreground">
            This file is attached, but its download URL could not be created.
          </p>
        </div>
        {replacementError ? (
          <p role="alert" className="text-sm text-destructive">
            {replacementError}
          </p>
        ) : null}
        {canReplaceFile ? (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isReplacing}
            >
              <Upload className="size-4" aria-hidden="true" />
              {isReplacing ? 'Replacing...' : 'Replace file'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              aria-label="Choose file replacement"
              accept={FILE_UPLOAD_ACCEPT_PATTERN}
              onChange={handleFileChange}
              disabled={isReplacing}
              tabIndex={-1}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

function EmptyFileViewer({
  canReplaceFile,
  file,
  source,
}: {
  canReplaceFile: boolean
  file: FileItemWithContent
  source: FileViewerSource
}) {
  const fileUpload = useEmptyFileUploadControl({
    enabled: canReplaceFile,
    file,
    maxUploadBytes: source.maxUploadBytes,
    replaceFile: source.replaceFile,
  })

  if (!canReplaceFile) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-sm text-muted-foreground">
        No file has been attached.
      </div>
    )
  }

  return (
    <FileUploadEmptyState
      fileUpload={fileUpload}
      icon={File}
      title="Upload File"
      description="Upload a file to add it to your workspace."
      isSubmitting={fileUpload.isUploading}
      acceptPattern={FILE_UPLOAD_ACCEPT_PATTERN}
      dragDropText="Drag a file here or click to browse"
    />
  )
}

function useEmptyFileUploadControl({
  enabled,
  file,
  maxUploadBytes,
  replaceFile,
}: {
  enabled: boolean
  file: FileItemWithContent
  maxUploadBytes?: number
  replaceFile: FileViewerSource['replaceFile']
}): FileUploadControl {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const { attemptFileReplacement, isReplacing, rejectFileReplacement, replacementError } =
    useFileReplacement({
      enabled,
      failureMessage: 'Failed to attach file',
      fileId: file.id,
      maxUploadBytes,
      onAcceptedFile: setSelectedFile,
      onReplacementError: () => setSelectedFile(null),
      replaceFile,
      successMessage: 'File uploaded',
    })

  const handleFileSelect = (candidateFile: File) => {
    return attemptFileReplacement(candidateFile)
  }
  const { handleDrag, handleDrop, isDragActive } = useFileDropControl(handleFileSelect, {
    onDropRejected: rejectFileReplacement,
  })

  return {
    file: selectedFile,
    fileInputRef,
    fileMetadata: selectedFile
      ? {
          name: selectedFile.name,
          type: selectedFile.type || 'application/octet-stream',
          size: selectedFile.size,
        }
      : null,
    handleDrag,
    handleDrop,
    handleFileSelect,
    isDragActive,
    isUploading: isReplacing,
    preview: selectedFile ? selectedFile.name : '',
    uploadError: replacementError,
    uploadProgress: { percentage: isReplacing ? 50 : 0 },
  }
}

function FileViewerHeader({
  canReplaceFile,
  file,
  maxUploadBytes,
  replaceFile,
  resolvedFile,
}: {
  canReplaceFile: boolean
  file: FileItemWithContent
  maxUploadBytes?: number
  replaceFile: FileViewerSource['replaceFile']
  resolvedFile: AvailableResolvedFile
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { attemptFileReplacement, isReplacing, replacementError } = useFileReplacement({
    enabled: canReplaceFile,
    failureMessage: 'Failed to replace file',
    fileId: file.id,
    maxUploadBytes,
    replaceFile,
    successMessage: 'File replaced',
  })
  const safeDownloadUrl =
    resolvedFile.downloadUrl &&
    isValidFileUrl(resolvedFile.downloadUrl, {
      allowDataUrl: resolvedFile.allowDataUrl,
      allowObjectUrl: resolvedFile.allowObjectUrl,
    })
      ? resolvedFile.downloadUrl
      : null

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) =>
    handleFileReplacementInputChange(event, attemptFileReplacement)

  return (
    <header className="flex min-h-12 shrink-0 flex-col gap-2 border-b bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{resolvedFile.name}</p>
          <p className="text-xs text-muted-foreground">
            {fileMetadataLabel(resolvedFile.contentType, resolvedFile.size)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {safeDownloadUrl ? (
            <a
              href={safeDownloadUrl}
              download={resolvedFile.name}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <Download aria-hidden="true" />
              Download
            </a>
          ) : null}
          {canReplaceFile ? (
            <FileReplaceButton
              fileInputRef={fileInputRef}
              isReplacing={isReplacing}
              onFileChange={handleFileChange}
            />
          ) : null}
        </div>
      </div>
      {replacementError ? (
        <p className="text-sm text-destructive" role="alert">
          {replacementError}
        </p>
      ) : null}
    </header>
  )
}

function useFileReplacement({
  enabled,
  failureMessage,
  fileId,
  maxUploadBytes,
  onAcceptedFile,
  onReplacementError,
  replaceFile,
  successMessage,
}: {
  enabled: boolean
  failureMessage: string
  fileId: FileItemWithContent['id']
  maxUploadBytes?: number
  onAcceptedFile?: (file: File) => void
  onReplacementError?: (message: string) => void
  replaceFile: FileViewerSource['replaceFile']
  successMessage: string
}) {
  const {
    attemptReplacement: attemptFileReplacement,
    isReplacing,
    rejectReplacement: rejectFileReplacement,
    replacementError,
  } = useResourceReplacementController({
    disabledMessage: 'File uploads are disabled',
    enabled,
    failureMessage,
    inProgressMessage: 'File upload already in progress',
    onAcceptedFile,
    onReplacementError,
    replace: (selectedFile) =>
      replaceFile({
        fileId,
        file: createBrowserImportFile(selectedFile),
      }),
    successMessage,
    validateFile: (selectedFile) =>
      validateFileUpload(selectedFile.type, selectedFile.size, selectedFile.name, maxUploadBytes),
  })

  return { attemptFileReplacement, isReplacing, rejectFileReplacement, replacementError }
}

function FileReplaceButton({
  fileInputRef,
  isReplacing,
  onFileChange,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>
  isReplacing: boolean
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isReplacing}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload aria-hidden="true" />
        {isReplacing ? 'Replacing…' : 'Replace'}
      </Button>
      <input
        ref={fileInputRef}
        accept={FILE_UPLOAD_ACCEPT_PATTERN}
        aria-label="Choose file replacement"
        className="sr-only"
        disabled={isReplacing}
        tabIndex={-1}
        type="file"
        onChange={onFileChange}
      />
    </>
  )
}

function fileMetadataLabel(contentType: string | null, size: number | null) {
  const type = contentType ?? 'Unknown type'
  return size === null ? type : `${type} · ${formatFileSize(size)}`
}

function handleFileReplacementInputChange(
  event: ChangeEvent<HTMLInputElement>,
  replaceFile: (file: File) => void,
) {
  const selectedFile = event.currentTarget.files?.[0]
  event.currentTarget.value = ''
  if (selectedFile) replaceFile(selectedFile)
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
