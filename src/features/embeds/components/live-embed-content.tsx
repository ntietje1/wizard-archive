import type { ComponentProps } from 'react'
import { LiveSidebarItemEmbedResolver } from './live-sidebar-item-embed-resolver'
import { EmbedContent } from './embed-content'

type LiveEmbedContentProps = Omit<ComponentProps<typeof EmbedContent>, 'resolvedSidebarItemState'>

export function LiveEmbedContent(props: LiveEmbedContentProps) {
  return (
    <LiveSidebarItemEmbedResolver target={props.target}>
      {(itemState) => <EmbedContent {...props} resolvedSidebarItemState={itemState} />}
    </LiveSidebarItemEmbedResolver>
  )
}
