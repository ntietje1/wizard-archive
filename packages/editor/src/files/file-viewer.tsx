import { File as FileIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { FileContentSource, FileResourceContent } from '../resources/content-session-contract'
import type { VersionStamp } from '../resources/component-version'
import type { ResourceId } from '../resources/domain-id'
import { FileContentPreview } from './file-content-preview'
import { useFileContentUrl } from './use-file-content-url'

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
      {content.attachment === 'unattached' ? (
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
  const { retry, state } = useFileContentUrl(source, resourceId, version)
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
    <section aria-label="File preview" className="min-h-0 flex-1">
      <FileContentPreview content={content} fileName={fileName} url={state.url} />
    </section>
  )
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

function fileDownloadName(title: string, extension: string | null): string {
  if (!extension || title.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) return title
  return `${title}.${extension}`
}
