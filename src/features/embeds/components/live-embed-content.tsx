import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type { Id } from 'convex/_generated/dataModel'
import type { ComponentProps } from 'react'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { useSidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import { EmbedContent } from './embed-content'

type LiveEmbedContentProps = Omit<ComponentProps<typeof EmbedContent>, 'resolvedSidebarItemState'>

export function LiveEmbedContent(props: LiveEmbedContentProps) {
  if (props.target.kind !== 'sidebarItem') {
    return <EmbedContent {...props} />
  }

  return <LiveSidebarItemEmbedContent {...props} target={props.target} />
}

function LiveSidebarItemEmbedContent({
  target,
  ...props
}: LiveEmbedContentProps & {
  target: Extract<EmbedTarget, { kind: 'sidebarItem' }>
}) {
  const targetItemId = target.sidebarItemId as Id<'sidebarItems'>
  const contentQuery = useSidebarItemById(targetItemId)
  const itemState = useSidebarItemAvailabilityState({
    lookup: { kind: 'id', id: targetItemId },
    readableItem: contentQuery.data,
    readableItemLoading: contentQuery.isLoading,
    readableItemError: contentQuery.error,
    canView: contentQuery.data != null,
    subject: 'item',
    fallbackLabel: 'Embedded item',
  })

  return <EmbedContent {...props} target={target} resolvedSidebarItemState={itemState} />
}
