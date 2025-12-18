import type {
  AnySidebarItem,
  SidebarItemOrRootType,
  SidebarItemId,
} from 'convex/sidebarItems/types'
import type { MenuContext, ViewContext } from './types'
import type { CampaignMemberRole } from 'convex/campaigns/types'
import type { TagCategory } from 'convex/tags/types'

// ============================================================================
// Context Enhancers
// ============================================================================

/**
 * A context enhancer adds additional context to the menu context.
 * This allows different parts of the app to contribute context without
 * modifying the core system.
 */
export interface ContextEnhancer {
  /**
   * Unique identifier for this enhancer
   */
  id: string

  /**
   * Enhances the base context with additional data.
   * Should merge new data into the existing partial context.
   */
  enhance(context: Partial<MenuContext>): Partial<MenuContext>
}

/**
 * Enhancer that adds campaign-related context (permissions, user info)
 */
export function createCampaignEnhancer(
  memberRole?: CampaignMemberRole,
  currentUserId?: string,
): ContextEnhancer {
  return {
    id: 'campaign',
    enhance: (ctx) => ({
      ...ctx,
      memberRole,
      currentUserId,
    }),
  }
}

/**
 * Enhancer that adds map view context (active map, pinned items)
 */
export function createMapViewEnhancer(
  activeMapId?: string,
  pinnedItemIds?: Set<SidebarItemId>,
): ContextEnhancer {
  return {
    id: 'mapView',
    enhance: (ctx) => ({
      ...ctx,
      activeMapId,
      pinnedItemIds,
    }),
  }
}

/**
 * Enhancer that adds category context
 */
export function createCategoryEnhancer(
  category?: TagCategory,
): ContextEnhancer {
  return {
    id: 'category',
    enhance: (ctx) => ({
      ...ctx,
      category,
    }),
  }
}

// ============================================================================
// Context Builder
// ============================================================================

/**
 * Options for building menu context.
 * Extends Partial<MenuContext> to allow enhancers to provide any context fields.
 * Requires only core fields: item, viewContext, and parentType.
 */
export interface ContextBuilderOptions extends Partial<MenuContext> {
  item: AnySidebarItem | undefined
  viewContext: ViewContext
  parentType: SidebarItemOrRootType
}

/**
 * Creates a complete MenuContext from partial context options.
 * Enhancers can provide additional context fields via the Partial<MenuContext> extension.
 */
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
    pinnedItemIds,
  } = options

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

    // View state
    activeMapId,
    activeCanvasId,
    pinnedItemIds,

    // Pin context
    pinId: options.pinId,
    mapId: options.mapId,
  }
}
