import type { EmbedTarget } from '../../../../../shared/embeds/embedTargets'
import type { ReactNode } from 'react'
import type { ResourceContentState } from '../../filesystem/resource-content-source'
import { useResourceContentState } from '../../filesystem/resource-content-context'
import type { AnyItem, AnyItemWithContent } from '../../workspace/items'
import type { ResourceId } from '../../resources/domain-id'
import { EmbedAncestryProvider } from '../context/render-ancestry'
import { useEmbedAncestry } from '../context/render-ancestry-context'
import { EmbedEmptyState } from './embed-empty-state'
import { EmbedLoadingState } from './embed-loading-state'
import { EmbedUnavailable } from './embed-unavailable'
import { ExternalUrlEmbedContent } from './external-url-embed-content'
import { ResourcePreviewSurface } from '../../previews/resource-preview-surface'
import type { ResourcePreviewRenderer } from '../../previews/resource-preview-surface'
import { getResourceUnavailableFallbackReason } from '../../previews/fallback-policy'
import type { EmbeddedNotePreviewRenderer } from '../../notes/embeds/embedded-note-preview-renderer'
import type { EmbedMediaLayoutReporter } from '../utils/media'
import type { EmbedDropTargetVisualState } from '../hooks/use-drop-target'

export type ResourceEmbedSurfaceRenderer = (input: {
  item: AnyItemWithContent
  allowInnerScroll: boolean
  folderChildren?: Array<AnyItem>
  onMediaLayout?: EmbedMediaLayoutReporter
}) => ReactNode

type EmbedContentProps = {
  target: EmbedTarget
  sourceItemId: ResourceId | null
  mode: 'editable' | 'readonly'
  loadingLabel?: string
  onUpload?: () => void
  onLinkExternal?: () => void
  onMediaLayout?: EmbedMediaLayoutReporter
  allowInnerScroll?: boolean
  dropVisualState?: EmbedDropTargetVisualState
  renderResourceSurface?: ResourceEmbedSurfaceRenderer
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
  resolvedResourceContentState?: ResourceContentState
}

export function EmbedContent(props: EmbedContentProps) {
  const { sourceItemId } = props
  if (sourceItemId) {
    return (
      <EmbedAncestryProvider itemId={sourceItemId}>
        <EmbedContentInner {...props} />
      </EmbedAncestryProvider>
    )
  }

  return <EmbedContentInner {...props} />
}

function EmbedContentInner({
  target,
  sourceItemId,
  mode,
  loadingLabel,
  onUpload,
  onLinkExternal,
  onMediaLayout,
  allowInnerScroll = true,
  dropVisualState,
  renderResourceSurface,
  renderEmbeddedNotePreview,
  resolvedResourceContentState,
}: EmbedContentProps) {
  if (loadingLabel) {
    return <EmbedLoadingState label={loadingLabel} />
  }

  if (target.kind === 'empty') {
    return (
      <EmbedEmptyState
        mode={mode}
        onUpload={onUpload}
        onLinkExternal={onLinkExternal}
        dropVisualState={mode === 'editable' ? dropVisualState : undefined}
      />
    )
  }

  if (target.kind === 'externalUrl') {
    return (
      <ExternalUrlEmbedContent
        url={target.url}
        name={target.name}
        allowInnerScroll={allowInnerScroll}
        onMediaLayout={onMediaLayout}
      />
    )
  }

  return (
    <ResourceEmbedContent
      targetItemId={target.resourceId}
      sourceItemId={sourceItemId}
      onMediaLayout={onMediaLayout}
      allowInnerScroll={allowInnerScroll}
      renderResourceSurface={renderResourceSurface}
      renderEmbeddedNotePreview={renderEmbeddedNotePreview}
      resolvedResourceContentState={resolvedResourceContentState}
    />
  )
}

function ResourceEmbedContent({
  targetItemId,
  sourceItemId,
  onMediaLayout,
  allowInnerScroll,
  renderResourceSurface,
  renderEmbeddedNotePreview,
  resolvedResourceContentState,
}: {
  targetItemId: ResourceId
  sourceItemId: ResourceId | null
  onMediaLayout?: EmbedMediaLayoutReporter
  allowInnerScroll: boolean
  renderResourceSurface?: ResourceEmbedSurfaceRenderer
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
  resolvedResourceContentState?: ResourceContentState
}) {
  const ancestry = useEmbedAncestry()
  const isRecursive = targetItemId === sourceItemId || ancestry.has(targetItemId)
  const contextItemState = useResourceContentState(targetItemId, 'Embedded item')
  const itemState = resolvedResourceContentState ?? contextItemState

  if (isRecursive) {
    return <EmbedUnavailable reason="recursive" />
  }

  return (
    <ResolvedResourceEmbedContent
      targetItemId={targetItemId}
      itemState={itemState}
      onMediaLayout={onMediaLayout}
      allowInnerScroll={allowInnerScroll}
      renderResourceSurface={renderResourceSurface}
      renderEmbeddedNotePreview={renderEmbeddedNotePreview}
    />
  )
}

function ResolvedResourceEmbedContent({
  targetItemId,
  itemState,
  onMediaLayout,
  allowInnerScroll,
  renderResourceSurface,
  renderEmbeddedNotePreview,
}: {
  targetItemId: ResourceId
  itemState: ResourceContentState
  onMediaLayout?: EmbedMediaLayoutReporter
  allowInnerScroll: boolean
  renderResourceSurface?: ResourceEmbedSurfaceRenderer
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
}) {
  if (itemState.status === 'ready') {
    return (
      <EmbedAncestryProvider itemId={targetItemId}>
        <ResourceEmbedSurface
          item={itemState.item}
          allowInnerScroll={allowInnerScroll}
          folderChildren={itemState.folderChildren}
          onMediaLayout={onMediaLayout}
          renderResourceSurface={renderResourceSurface}
          renderEmbeddedNotePreview={renderEmbeddedNotePreview}
        />
      </EmbedAncestryProvider>
    )
  }

  if (itemState.status === 'idle' || itemState.status === 'loading') {
    return <EmbedLoadingState label={`Loading ${itemState.label}`} />
  }

  if (itemState.status === 'unsupported') {
    return <EmbedUnavailable reason="unavailable" label={itemState.label} />
  }

  const fallbackStatus =
    itemState.status === 'unavailable' ? itemState.availabilityState.status : itemState.status
  const reason = getResourceUnavailableFallbackReason(fallbackStatus)
  return <EmbedUnavailable reason={reason} label={itemState.label} />
}

function ResourceEmbedSurface({
  item,
  allowInnerScroll,
  folderChildren,
  onMediaLayout,
  renderResourceSurface,
  renderEmbeddedNotePreview,
}: {
  item: AnyItemWithContent
  allowInnerScroll?: boolean
  folderChildren?: Array<AnyItem>
  onMediaLayout?: EmbedMediaLayoutReporter
  renderResourceSurface?: ResourceEmbedSurfaceRenderer
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
}) {
  if (renderResourceSurface) {
    return renderResourceSurface({
      item,
      allowInnerScroll: allowInnerScroll ?? true,
      folderChildren,
      onMediaLayout,
    })
  }

  const renderPreview: ResourcePreviewRenderer = (input) => {
    if (input.kind !== 'note') return undefined
    if (!renderEmbeddedNotePreview) return undefined
    return renderEmbeddedNotePreview({
      note: input.item,
      allowInnerScroll: input.allowInnerScroll,
    })
  }

  return (
    <ResourcePreviewSurface
      item={item}
      allowInnerScroll={allowInnerScroll}
      fillAvailableHeight
      folderChildren={folderChildren}
      mode="embed"
      onMediaLayout={onMediaLayout}
      renderPreview={renderPreview}
    />
  )
}
