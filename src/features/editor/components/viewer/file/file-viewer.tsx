import { Download, File, Upload } from 'lucide-react'
import { FILE_UPLOAD_ACCEPT_PATTERN } from 'shared/storage/validation'
import { FileUploadEmptyState } from '~/features/file-upload/components/file-upload-empty-state'
import { FileContentViewer } from './file-content-viewer'
import type { ViewerProps } from '~/shared/viewer/viewer-props'
import type { FileWithContent } from 'shared/files/types'
import { Button, buttonVariants } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'
import { useFileViewerSource } from './file-viewer-source'
import type { ResolvedFileViewerFile } from './file-viewer-source'
import type { ChangeEvent, RefObject } from 'react'
import { useRef } from 'react'

export function FileViewer({ item: file }: ViewerProps<FileWithContent>) {
  const source = useFileViewerSource()
  const resolvedFile = source.resolveFile(file)

  if (!resolvedFile.downloadUrl) {
    return <EmptyFileViewer file={file} source={source} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
      <FileViewerHeader file={file} resolvedFile={resolvedFile} replaceFile={source.replaceFile} />
      <section className="min-h-0 flex-1" aria-label="File preview">
        <FileContentViewer
          key={resolvedFile.downloadUrl}
          allowObjectUrl={resolvedFile.allowObjectUrl}
          downloadUrl={resolvedFile.downloadUrl}
          contentType={resolvedFile.contentType}
          name={resolvedFile.name}
        />
      </section>
    </div>
  )
}

function EmptyFileViewer({ file, source }: { file: FileWithContent; source: FileViewerSource }) {
  const upload = source.getEmptyFileUpload(file)

  if (!upload) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-sm text-muted-foreground">
        No file has been attached.
      </div>
    )
  }

  return (
    <FileUploadEmptyState
      fileUpload={upload.fileUpload}
      icon={File}
      title="Upload File"
      description="Upload a file to add it to your campaign."
      isSubmitting={upload.isSubmitting}
      acceptPattern={FILE_UPLOAD_ACCEPT_PATTERN}
      dragDropText="Drag a file here or click to browse"
    />
  )
}

function FileViewerHeader({
  file,
  replaceFile,
  resolvedFile,
}: {
  file: FileWithContent
  replaceFile: FileViewerSourceReplaceFile | undefined
  resolvedFile: ResolvedFileViewerFile
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!selectedFile || !replaceFile) return
    void replaceFile(file, selectedFile)
  }

  return (
    <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{resolvedFile.name}</p>
        <p className="text-xs text-muted-foreground">
          {fileMetadataLabel(resolvedFile.contentType, resolvedFile.size)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={resolvedFile.downloadUrl ?? undefined}
          download={resolvedFile.name}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          <Download aria-hidden="true" />
          Download
        </a>
        {replaceFile && (
          <FileReplaceButton fileInputRef={fileInputRef} onFileChange={handleFileChange} />
        )}
      </div>
    </header>
  )
}

type FileViewerSource = ReturnType<typeof useFileViewerSource>
type FileViewerSourceReplaceFile = NonNullable<
  ReturnType<typeof useFileViewerSource>['replaceFile']
>

function FileReplaceButton({
  fileInputRef,
  onFileChange,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload aria-hidden="true" />
        Replace
      </Button>
      <input
        ref={fileInputRef}
        aria-label="Choose file replacement"
        className="sr-only"
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

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
