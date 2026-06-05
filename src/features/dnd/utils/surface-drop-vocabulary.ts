import {
  CANVAS_DROP_ZONE_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
} from './drop-target-data'
import type { SidebarDropData } from './drop-target-data'

const SURFACE_DROP_COMMAND_IDS = {
  pin: 'surface-drop.pin-sidebar-item-to-map',
  link: 'surface-drop.link-sidebar-item-in-note',
  embed: 'surface-drop.embed-sidebar-item-in-canvas',
} as const

export type SurfaceDropAction = keyof typeof SURFACE_DROP_COMMAND_IDS

export type SurfaceDropCommandIdForAction<TAction extends SurfaceDropAction> =
  (typeof SURFACE_DROP_COMMAND_IDS)[TAction]

const SURFACE_DROP_TARGET_TYPES = {
  pin: MAP_DROP_ZONE_TYPE,
  link: NOTE_EDITOR_DROP_TYPE,
  embed: CANVAS_DROP_ZONE_TYPE,
} as const satisfies Record<SurfaceDropAction, SidebarDropData['type']>

type SurfaceDropContributionDescriptor<TAction extends SurfaceDropAction> = {
  action: TAction
  commandId: SurfaceDropCommandIdForAction<TAction>
  targetType: (typeof SURFACE_DROP_TARGET_TYPES)[TAction]
}

export function getSurfaceDropContribution<TAction extends SurfaceDropAction>(
  action: TAction,
): SurfaceDropContributionDescriptor<TAction> {
  return {
    action,
    commandId: SURFACE_DROP_COMMAND_IDS[action],
    targetType: SURFACE_DROP_TARGET_TYPES[action],
  }
}
