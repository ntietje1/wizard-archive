import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
import type { ReactNode } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { useSidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import { EmbedAncestryProvider } from '../context/embed-render-ancestry'
import { useEmbedAncestry } from '../context/embed-render-ancestry-context'
import { EmbedEmptyState } from './embed-empty-state'
import { EmbedUnavailable } from './embed-unavailable'
import { ExternalUrlEmbedContent } from './external-url-embed-content'
import { FileMediaEmbedContent } from './file-media-embed-content'
import type { IntrinsicAspectRatioReporter } from '../utils/embed-media'

type EmbedContentProps = {
  target: EmbedTarget
  sourceItemId: Id<'sidebarItems'> | null
  mode: 'editable' | 'readonly'
  onUpload?: () => void
  onLinkExternal?: () => void
  onIntrinsicAspectRatio?: IntrinsicAspectRatioReporter
  renderSidebarItem: (item: AnySidebarItemWithContent) => ReactNode
}

export function EmbedContent({
  target,
  sourceItemId,
  mode,
  onUpload,
  onLinkExternal,
  onIntrinsicAspectRatio,
  renderSidebarItem,
}: EmbedContentProps) {
  if (sourceItemId) {
    return (
      <EmbedAncestryProvider itemId={sourceItemId}>
        <EmbedContentInner
          target={target}
          sourceItemId={sourceItemId}
          mode={mode}
          onUpload={onUpload}
          onLinkExternal={onLinkExternal}
          onIntrinsicAspectRatio={onIntrinsicAspectRatio}
          renderSidebarItem={renderSidebarItem}
        />
      </EmbedAncestryProvider>
    )
  }

  return (
    <EmbedContentInner
      target={target}
      sourceItemId={sourceItemId}
      mode={mode}
      onUpload={onUpload}
      onLinkExternal={onLinkExternal}
      onIntrinsicAspectRatio={onIntrinsicAspectRatio}
      renderSidebarItem={renderSidebarItem}
    />
  )
}

function EmbedContentInner({
  target,
  sourceItemId,
  mode,
  onUpload,
  onLinkExternal,
  onIntrinsicAspectRatio,
  renderSidebarItem,
}: EmbedContentProps) {
  if (target.kind === 'empty') {
    return <EmbedEmptyState mode={mode} onUpload={onUpload} onLinkExternal={onLinkExternal} />
  }

  if (target.kind === 'externalUrl') {
    return (
      <ExternalUrlEmbedContent
        url={target.url}
        name={target.name}
        onIntrinsicAspectRatio={onIntrinsicAspectRatio}
      />
    )
  }

  return (
    <SidebarItemEmbedContent
      targetItemId={target.sidebarItemId as Id<'sidebarItems'>}
      sourceItemId={sourceItemId}
      onIntrinsicAspectRatio={onIntrinsicAspectRatio}
      renderSidebarItem={renderSidebarItem}
    />
  )
}

function SidebarItemEmbedContent({
  targetItemId,
  sourceItemId,
  onIntrinsicAspectRatio,
  renderSidebarItem,
}: {
  targetItemId: Id<'sidebarItems'>
  sourceItemId: Id<'sidebarItems'> | null
  onIntrinsicAspectRatio?: IntrinsicAspectRatioReporter
  renderSidebarItem: (item: AnySidebarItemWithContent) => ReactNode
}) {
  const ancestry = useEmbedAncestry()
  const isRecursive = targetItemId === sourceItemId || ancestry.has(targetItemId)
  const contentQuery = useSidebarItemById(isRecursive ? null : targetItemId)
  const itemState = useSidebarItemAvailabilityState({
    lookup: { kind: 'id', id: isRecursive ? null : targetItemId },
    readableItem: contentQuery.data,
    readableItemLoading: contentQuery.isLoading,
    readableItemError: contentQuery.error,
    canView: contentQuery.data != null,
    subject: 'item',
    fallbackLabel: 'Embedded item',
  })

  if (isRecursive) {
    return <EmbedUnavailable reason="recursive" />
  }

  if (itemState.status === 'available') {
    if (itemState.item.type === SIDEBAR_ITEM_TYPES.files) {
      return (
        <EmbedAncestryProvider itemId={targetItemId}>
          <FileMediaEmbedContent
            downloadUrl={itemState.item.downloadUrl}
            contentType={itemState.item.contentType}
            previewUrl={itemState.item.previewUrl}
            name={itemState.item.name}
            onIntrinsicAspectRatio={onIntrinsicAspectRatio}
          />
        </EmbedAncestryProvider>
      )
    }

    return (
      <EmbedAncestryProvider itemId={targetItemId}>
        {renderSidebarItem(itemState.item)}
      </EmbedAncestryProvider>
    )
  }

  if (itemState.status === 'loading') {
    return <EmbedUnavailable reason="missing" label={itemState.label} />
  }

  const reason =
    itemState.status === 'not_shared'
      ? 'permission'
      : itemState.status === 'trashed'
        ? 'trashed'
        : 'missing'
  return <EmbedUnavailable reason={reason} label={itemState.label} />
}
