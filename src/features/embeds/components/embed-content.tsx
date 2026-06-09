import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
import type { ComponentType } from 'react'
import type { SidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import { EmbedAncestryProvider } from '../context/embed-render-ancestry'
import { useEmbedAncestry } from '../context/embed-render-ancestry-context'
import { EmbedEmptyState } from './embed-empty-state'
import { EmbedLoadingState } from './embed-loading-state'
import { EmbedUnavailable } from './embed-unavailable'
import { ExternalUrlEmbedContent } from './external-url-embed-content'
import type { EmbedMediaLayoutReporter } from '../utils/embed-media'
import type { EmbedDropTargetVisualState } from '../hooks/use-embed-drop-target'

type EmbedContentProps = {
  target: EmbedTarget
  sourceItemId: Id<'sidebarItems'> | null
  mode: 'editable' | 'readonly'
  onUpload?: () => void
  onLinkExternal?: () => void
  onMediaLayout?: EmbedMediaLayoutReporter
  allowInnerScroll?: boolean
  dropVisualState?: EmbedDropTargetVisualState
  SidebarItemRenderer: SidebarItemEmbedRenderer
  resolvedSidebarItemState?: SidebarItemAvailabilityState
}

type SidebarItemEmbedRenderer = ComponentType<{
  item: AnySidebarItemWithContent
  allowInnerScroll?: boolean
  onMediaLayout?: EmbedMediaLayoutReporter
}>

export function EmbedContent({
  target,
  sourceItemId,
  mode,
  onUpload,
  onLinkExternal,
  onMediaLayout,
  allowInnerScroll = true,
  dropVisualState,
  SidebarItemRenderer,
  resolvedSidebarItemState,
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
          onMediaLayout={onMediaLayout}
          allowInnerScroll={allowInnerScroll}
          dropVisualState={dropVisualState}
          SidebarItemRenderer={SidebarItemRenderer}
          resolvedSidebarItemState={resolvedSidebarItemState}
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
      onMediaLayout={onMediaLayout}
      allowInnerScroll={allowInnerScroll}
      dropVisualState={dropVisualState}
      SidebarItemRenderer={SidebarItemRenderer}
      resolvedSidebarItemState={resolvedSidebarItemState}
    />
  )
}

function EmbedContentInner({
  target,
  sourceItemId,
  mode,
  onUpload,
  onLinkExternal,
  onMediaLayout,
  allowInnerScroll = true,
  dropVisualState,
  SidebarItemRenderer,
  resolvedSidebarItemState,
}: EmbedContentProps) {
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
    <SidebarItemEmbedContent
      targetItemId={target.sidebarItemId as Id<'sidebarItems'>}
      sourceItemId={sourceItemId}
      onMediaLayout={onMediaLayout}
      allowInnerScroll={allowInnerScroll}
      SidebarItemRenderer={SidebarItemRenderer}
      resolvedSidebarItemState={resolvedSidebarItemState}
    />
  )
}

function SidebarItemEmbedContent({
  targetItemId,
  sourceItemId,
  onMediaLayout,
  allowInnerScroll,
  SidebarItemRenderer,
  resolvedSidebarItemState,
}: {
  targetItemId: Id<'sidebarItems'>
  sourceItemId: Id<'sidebarItems'> | null
  onMediaLayout?: EmbedMediaLayoutReporter
  allowInnerScroll: boolean
  SidebarItemRenderer: SidebarItemEmbedRenderer
  resolvedSidebarItemState?: SidebarItemAvailabilityState
}) {
  const ancestry = useEmbedAncestry()
  const isRecursive = targetItemId === sourceItemId || ancestry.has(targetItemId)

  if (isRecursive) {
    return <EmbedUnavailable reason="recursive" />
  }

  if (resolvedSidebarItemState) {
    return (
      <ResolvedSidebarItemEmbedContent
        targetItemId={targetItemId}
        itemState={resolvedSidebarItemState}
        onMediaLayout={onMediaLayout}
        allowInnerScroll={allowInnerScroll}
        SidebarItemRenderer={SidebarItemRenderer}
      />
    )
  }

  return (
    <ResolvedSidebarItemEmbedContent
      targetItemId={targetItemId}
      itemState={{
        status: 'not_found',
        label: 'Embedded item',
        message: "This item doesn't exist.",
      }}
      onMediaLayout={onMediaLayout}
      allowInnerScroll={allowInnerScroll}
      SidebarItemRenderer={SidebarItemRenderer}
    />
  )
}

function ResolvedSidebarItemEmbedContent({
  targetItemId,
  itemState,
  onMediaLayout,
  allowInnerScroll,
  SidebarItemRenderer,
}: {
  targetItemId: Id<'sidebarItems'>
  itemState: SidebarItemAvailabilityState
  onMediaLayout?: EmbedMediaLayoutReporter
  allowInnerScroll: boolean
  SidebarItemRenderer: SidebarItemEmbedRenderer
}) {
  if (itemState.status === 'available') {
    return (
      <EmbedAncestryProvider itemId={targetItemId}>
        <SidebarItemRenderer
          item={itemState.item}
          allowInnerScroll={allowInnerScroll}
          onMediaLayout={onMediaLayout}
        />
      </EmbedAncestryProvider>
    )
  }

  if (itemState.status === 'loading') {
    return <EmbedLoadingState label={`Loading ${itemState.label}`} />
  }

  const reason =
    itemState.status === 'not_shared'
      ? 'permission'
      : itemState.status === 'trashed'
        ? 'trashed'
        : 'missing'
  return <EmbedUnavailable reason={reason} label={itemState.label} />
}
