import { Download, File as FileIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  FILE_UPLOAD_ACCEPT_PATTERN,
  validateFileUpload,
} from '../../../../shared/storage/validation'
import type { FileContentSource, FileResourceContent } from '../resources/content-session-contract'
import type { VersionStamp } from '../resources/component-version'
import type { ResourceId } from '../resources/domain-id'
import { FILE_CLASSIFICATION } from '../resources/file-content-contract'
import { ImageFileViewer } from './image-file-viewer'
import { MediaFileViewer } from './media-file-viewer'
import { useAssetReplacement } from '../resources/asset-replacement'
import type { AssetReplacementController } from '../resources/asset-replacement'
import { AssetReplacementButton } from '../resources/asset-replacement-button'
import { beginContentObjectUrlLoad } from '../resources/content-object-url'
import type { ContentObjectUrlState } from '../resources/content-object-url'

const PdfFileViewer = lazy(() =>
  import('./pdf-file-viewer').then(({ PdfFileViewer: Viewer }) => ({ default: Viewer })),
)

type FileBytesState = ContentObjectUrlState

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
  const replacement = useFileReplacement(source, resourceId, version)
  return (
    <div
      aria-label="File content"
      className="flex min-h-0 flex-1 flex-col bg-muted/20 data-[file-drag-active=true]:ring-2 data-[file-drag-active=true]:ring-inset data-[file-drag-active=true]:ring-ring"
      data-file-drag-active={replacement.dragActive}
      data-workspace-mode={canEdit ? 'editor' : 'viewer'}
      onDragLeave={canEdit ? replacement.onDragLeave : undefined}
      onDragOver={canEdit ? replacement.onDragOver : undefined}
      onDrop={canEdit ? replacement.onDrop : undefined}
    >
      {content.attachment === 'unattached' ? (
        <FileState
          title="No file attached"
          description={canEdit ? 'Attach a file to make this resource available.' : undefined}
          action={canEdit ? <FileReplacementControl replacement={replacement} /> : undefined}
        />
      ) : (
        <AttachedFileViewer
          canEdit={canEdit}
          content={content}
          replacement={replacement}
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
  canEdit,
  content,
  replacement,
  resourceId,
  source,
  title,
  version,
}: {
  canEdit: boolean
  content: FileResourceContent
  replacement: FileReplacementController
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
        <div className="flex shrink-0 items-center gap-2">
          <a
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted"
            download={fileName}
            href={state.url}
          >
            <Download className="size-4" aria-hidden="true" />
            Download
          </a>
          {canEdit && <FileReplacementControl compact replacement={replacement} />}
        </div>
      </header>
      {replacement.message && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2 text-sm">
          <p role={replacement.failed ? 'alert' : 'status'}>{replacement.message}</p>
          {replacement.canRetry && (
            <button type="button" className="underline" onClick={replacement.retry}>
              Try again
            </button>
          )}
        </div>
      )}
      <section aria-label="File preview" className="min-h-0 flex-1">
        <FileContent content={content} fileName={fileName} url={state.url} />
      </section>
    </>
  )
}

type FileReplacementController = AssetReplacementController

function useFileReplacement(
  source: FileContentSource,
  resourceId: ResourceId,
  version: VersionStamp,
): FileReplacementController {
  return useAssetReplacement({
    target: {
      owner: source,
      key: JSON.stringify([resourceId, version.revision, version.digest]),
      value: { source, resourceId, expectedVersion: version },
    },
    replace: async (target, candidate) =>
      await target.source.replace(target.resourceId, target.expectedVersion, candidate),
    validate: (file) => {
      const result = validateFileUpload(file.type || null, file.size, file.name)
      return result.valid ? null : result.error
    },
    message: (result) => fileReplacementMessage(result.reason),
    retryable: (result) => result.status === 'retryable',
    readingMessage: 'Reading file…',
    uploadingMessage: 'Uploading replacement…',
    readFailureMessage: 'The selected file could not be read.',
    responseLostMessage: 'The file replacement could not be confirmed.',
  })
}

function FileReplacementControl({
  compact = false,
  replacement,
}: {
  compact?: boolean
  replacement: FileReplacementController
}) {
  return (
    <div className={compact ? '' : 'mt-4 flex flex-col items-center gap-2'}>
      <AssetReplacementButton
        accept={FILE_UPLOAD_ACCEPT_PATTERN}
        ariaLabel="Choose file replacement"
        compact={compact}
        compactLabel="Replace"
        fullLabel="Choose file"
        pendingLabel="Replacing…"
        replacement={replacement}
      />
      {!compact && (
        <p className="text-xs text-muted-foreground">
          {replacement.dragActive ? 'Drop the file here' : 'Or drag and drop a file here'}
        </p>
      )}
      {!compact && replacement.message && (
        <p className="text-sm" role={replacement.failed ? 'alert' : 'status'}>
          {replacement.message}
        </p>
      )}
      {!compact && replacement.canRetry && (
        <button type="button" className="text-sm underline" onClick={replacement.retry}>
          Try again
        </button>
      )}
    </div>
  )
}

function fileReplacementMessage(reason: string): string {
  switch (reason) {
    case 'content_initializing':
      return 'The file is still being prepared.'
    case 'response_lost':
      return 'The file replacement could not be confirmed.'
    case 'version_conflict':
      return 'This file changed while the replacement was uploading.'
    case 'invalid_file':
      return 'The selected file type is not supported.'
    case 'content_corrupt':
    case 'content_missing':
      return 'The existing file content is unavailable.'
    case 'resource_missing':
    case 'unauthorized':
      return 'You can no longer replace this file.'
    case 'version_exhausted':
      return 'This file cannot accept another revision.'
    default:
      return 'The file could not be replaced.'
  }
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
        />
      )
  }
}

function FileState({
  action,
  description,
  title,
}: {
  action?: ReactNode
  description?: string
  title: string
}) {
  return (
    <div className="flex h-full min-h-72 w-full items-center justify-center p-6 text-center">
      <div className="flex max-w-md flex-col items-center">
        <FileIcon className="mb-3 size-9 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {action}
      </div>
    </div>
  )
}

function useFileBytes(source: FileContentSource, resourceId: ResourceId, version: VersionStamp) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<FileBytesState>({ status: 'loading' })

  useEffect(() => {
    return beginContentObjectUrlLoad(() => source.export(resourceId), setState)
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
