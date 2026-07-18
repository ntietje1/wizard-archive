import type { FileContentSource, FileResourceContent } from '../resources/content-session-contract'
import type { VersionStamp } from '../resources/component-version'
import type { ResourceId } from '../resources/domain-id'
import { FileContentPreview, FilePreviewState } from './file-content-preview'
import { useFileContentUrl } from './use-file-content-url'

export function FileEmbedPreview({
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
  if (content.attachment === 'unattached') {
    return <FilePreviewState compact title="No file attached" />
  }
  return (
    <AttachedFileEmbedPreview
      content={content}
      resourceId={resourceId}
      source={source}
      title={title}
      version={version}
    />
  )
}

function AttachedFileEmbedPreview({
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
  if (state.status === 'loading') return <FilePreviewState compact title="Loading file…" />
  if (state.status === 'failed') {
    return (
      <FilePreviewState
        compact
        title="Could not load this file"
        action={
          <button type="button" className="mt-2 text-sm underline" onClick={retry}>
            Try again
          </button>
        }
      />
    )
  }
  if (state.status === 'unavailable') {
    return <FilePreviewState compact title="File unavailable" description={state.reason} />
  }
  if (state.status === 'integrity_error') {
    return <FilePreviewState compact title="File could not be verified" description={state.issue} />
  }
  return (
    <FileContentPreview
      content={content}
      fileName={fileDownloadName(title, content.extension)}
      url={state.url}
    />
  )
}

function fileDownloadName(title: string, extension: string | null): string {
  if (!extension || title.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) return title
  return `${title}.${extension}`
}
