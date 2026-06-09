import type { ComponentType } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { RightSidebarContentId } from '~/features/editor/chrome/right-sidebar-content'

interface RightSidebarPanelRenderArgs {
  itemId: Id<'sidebarItems'>
}

export type RightSidebarPanelServices = Record<
  RightSidebarContentId,
  ComponentType<RightSidebarPanelRenderArgs>
>
