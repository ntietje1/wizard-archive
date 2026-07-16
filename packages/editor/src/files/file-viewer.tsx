import { Download, File as FileIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  ContentExportResult,
  FileContentSource,
  FileResourceContent,
} from '../resources/content-session-contract'
import type { VersionStamp } from '../resources/component-version'
import type { ResourceId } from '../resources/domain-id'
import { FILE_CLASSIFICATION } from '../resources/file-content-contract'
import { ImageFileViewer } from './image-file-viewer'
import { MediaFileViewer } from './media-file-viewer'

const PdfFileViewer = lazy(() =>
  import('./pdf-file-viewer').then(({ PdfFileViewer: Viewer }) => ({ default: Viewer })),
)

type FileBytesState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | Exclude<ContentExportResult, { status: 'ready' }>
  | Readonly<{
      status: 'ready'
      url: string
    }>

export function FileViewer({
  canEdit,
  content,
  resourceId,
  source,
  title,
  version,
}: {
  canEdit: boolean
  content: FileResourceContent
  resourceId: ResourceId
  source: FileContentSource
  title: string
  version: VersionStamp
}) {
  return (
    <div
      aria-label="File content"
      className="flex min-h-0 flex-1 flex-col bg-muted/20"
      data-workspace-mode={canEdit ? 'editor' : 'viewer'}
    >
      {content.assetId === null ? (
        <FileState
          title="No file attached"
          description={canEdit ? 'Attach a file to make this resource available.' : undefined}
        />
      ) : (
        <AttachedFileViewer
          content={content}
          resourceId={resourceId}
          source={source}
          title={title}
          version={version}
        />
      )}
    </div>
  )
}

function AttachedFileViewer({
  content,
  resourceId,
  source,
  title,
  version,
}: {
  content: FileResourceContent
  resourceId: ResourceId
  source: FileContentSource
  title: string
  version: VersionStamp
}) {
  const { retry, state } = useFileBytes(source, resourceId, version)
  if (state.status === 'loading') return <FileState title="Loading file…" />
  if (state.status === 'failed') {
    return (
      <FileState
        title="Could not load this file"
        action={
          <button type="button" className="mt-3 text-sm underline" onClick={retry}>
            Try again
          </button>
        }
      />
    )
  }
  if (state.status === 'unavailable') {
    return <FileState title="File unavailable" description={state.reason} />
  }
  if (state.status === 'integrity_error') {
    return <FileState title="File could not be verified" description={state.issue} />
  }

  const fileName = fileDownloadName(title, content.extension)
  return (
    <>
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            {fileMetadataLabel(content.mediaType, content.byteSize)}
          </p>
        </div>
        <a
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted"
          download={fileName}
          href={state.url}
        >
          <Download className="size-4" aria-hidden="true" />
          Download
        </a>
      </header>
      <section aria-label="File preview" className="min-h-0 flex-1">
        <FileContent content={content} fileName={fileName} url={state.url} />
      </section>
    </>
  )
}

function FileContent({
  content,
  fileName,
  url,
}: {
  content: FileResourceContent
  fileName: string
  url: string
}) {
  switch (content.classification) {
    case FILE_CLASSIFICATION.image:
      return <ImageFileViewer alt={fileName} url={url} />
    case FILE_CLASSIFICATION.pdf:
      return (
        <Suspense fallback={<FileState title="Loading PDF…" />}>
          <PdfFileViewer url={url} />
        </Suspense>
      )
    case FILE_CLASSIFICATION.audio:
      return <MediaFileViewer kind="audio" url={url} />
    case FILE_CLASSIFICATION.video:
      return <MediaFileViewer kind="video" url={url} />
    case FILE_CLASSIFICATION.inert:
      return (
        <FileState
          title={fileName}
          description={fileUnavailableDescription(content.viewerUnavailableReason)}
          download={{ fileName, url }}
        />
      )
  }
}

function FileState({
  action,
  description,
  download,
  title,
}: {
  action?: ReactNode
  description?: string
  download?: Readonly<{ fileName: string; url: string }>
  title: string
}) {
  return (
    <div className="flex h-full min-h-72 w-full items-center justify-center p-6 text-center">
      <div className="flex max-w-md flex-col items-center">
        <FileIcon className="mb-3 size-9 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {download && (
          <a
            className="mt-4 inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted"
            download={download.fileName}
            href={download.url}
          >
            <Download className="size-4" aria-hidden="true" />
            Download file
          </a>
        )}
        {action}
      </div>
    </div>
  )
}

function useFileBytes(source: FileContentSource, resourceId: ResourceId, version: VersionStamp) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<FileBytesState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setState({ status: 'loading' })
    void Promise.resolve(source.export(resourceId)).then(
      (result) => {
        if (!active) return
        if (result.status !== 'ready') {
          setState(result)
          return
        }
        objectUrl = URL.createObjectURL(
          new Blob([Uint8Array.from(result.bytes)], { type: result.mediaType }),
        )
        setState({
          status: 'ready',
          url: objectUrl,
        })
      },
      () => {
        if (active) setState({ status: 'failed' })
      },
    )
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attempt, resourceId, source, version.digest, version.revision, version.scheme])

  return { retry: () => setAttempt((current) => current + 1), state }
}

function fileDownloadName(title: string, extension: string | null): string {
  if (!extension || title.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) return title
  return `${title}.${extension}`
}

function fileMetadataLabel(mediaType: string, byteSize: number): string {
  const size =
    byteSize < 1024
      ? `${byteSize} B`
      : byteSize < 1024 * 1024
        ? `${(byteSize / 1024).toFixed(1)} KB`
        : `${(byteSize / (1024 * 1024)).toFixed(1)} MB`
  return `${mediaType} · ${size}`
}

function fileUnavailableDescription(
  reason: FileResourceContent['viewerUnavailableReason'],
): string {
  switch (reason) {
    case 'empty_file':
      return 'This file is empty.'
    case 'malformed':
    case 'encrypted':
      return 'This file cannot be previewed safely.'
    case 'limit_exceeded':
    case 'decoder_limit':
    case 'note_size_limit':
    case 'note_complexity':
      return 'This file is too large or complex to preview.'
    case 'parser_timeout':
      return 'The preview could not be prepared in time.'
    case 'invalid_utf8':
    case 'nul_byte':
    case 'unsupported_format':
    case null:
      return 'This file type cannot be previewed.'
  }
}
