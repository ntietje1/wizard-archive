import type {
  AnySidebarItem,
  SidebarItemOrRootType,
} from 'convex/sidebarItems/types'
import type { MenuContext, ViewContext } from './types'
import type { TagCategory } from 'convex/tags/types'
import {
  CAMPAIGN_MEMBER_ROLE,
  type CampaignMemberRole,
} from 'convex/campaigns/types'

interface ContextBuilderOptions {
  item: AnySidebarItem | undefined
  viewContext: ViewContext
  parentType: SidebarItemOrRootType

  category?: TagCategory
  currentUserId?: string
  memberRole?: CampaignMemberRole
  activeMapId?: string
  activeCanvasId?: string
}

export function createMenuContext(options: ContextBuilderOptions): MenuContext {
  const {
    item,
    viewContext,
    category,
    currentUserId,
    activeMapId,
    activeCanvasId,
    parentType,
    memberRole,
  } = options

  const isDm = memberRole === CAMPAIGN_MEMBER_ROLE.DM
  const canEdit = isDm
  const canDelete = isDm

  return {
    // Core
    item,
    viewContext,
    parentType,

    // Category context
    category,

    // Permissions
    currentUserId,
    memberRole,
    isDm,
    canEdit,
    canDelete,

    // View state
    activeMapId,
    activeCanvasId,
  }
}
