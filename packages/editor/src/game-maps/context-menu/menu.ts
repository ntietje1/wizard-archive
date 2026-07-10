import { Eye, EyeOff, MapPin, Move, Navigation, Trash2 } from 'lucide-react'
import * as p from '../../workspace/context-menu/predicates'
import * as selection from '../../workspace/context-menu/selection'
import { createActionCommand } from '../../context-menu/create-action-command'
import type { ContextMenuContributor } from '../../context-menu/types'
import type { WorkspaceMenuContext } from '../../workspace/menu-context'
import type { WorkspaceMapPinContextMenuActions } from './actions'
import type { WorkspaceMapPinMenuService } from './service'

export interface WorkspaceMapPinContextMenuServices {
  actions: {
    mapPins: WorkspaceMapPinContextMenuActions
  }
  mapPins: WorkspaceMapPinMenuService
}

type WorkspaceContextMenuContributor = ContextMenuContributor<
  WorkspaceMenuContext,
  WorkspaceMapPinContextMenuServices
>

export const mapPinContextMenuCommands = {
  pinToMap: createActionCommand<
    WorkspaceMenuContext,
    { mapPins: WorkspaceMapPinContextMenuActions }
  >('pinToMap', (actions, context) => actions.mapPins.pinToMap(context)),
  goToMapPin: createActionCommand<
    WorkspaceMenuContext,
    { mapPins: WorkspaceMapPinContextMenuActions }
  >('goToMapPin', (actions, context) => actions.mapPins.goToMapPin(context)),
  createMapPin: createActionCommand<
    WorkspaceMenuContext,
    { mapPins: WorkspaceMapPinContextMenuActions }
  >('createMapPin', (actions, context) => actions.mapPins.createMapPin(context)),
  removeMapPin: createActionCommand<
    WorkspaceMenuContext,
    { mapPins: WorkspaceMapPinContextMenuActions }
  >('removeMapPin', (actions, context) => actions.mapPins.removeMapPin(context)),
  moveMapPin: createActionCommand<
    WorkspaceMenuContext,
    { mapPins: WorkspaceMapPinContextMenuActions }
  >('moveMapPin', (actions, context) => actions.mapPins.moveMapPin(context)),
  togglePinVisibility: createActionCommand<
    WorkspaceMenuContext,
    { mapPins: WorkspaceMapPinContextMenuActions }
  >('togglePinVisibility', (actions, context) => actions.mapPins.togglePinVisibility(context)),
}

export const mapPinContextMenuContributors = [
  {
    id: 'game-map-pin-actions',
    surfaces: ['sidebar', 'map-view'],
    getItems: () => [
      {
        id: 'pin-to-map',
        commandId: 'pinToMap',
        label: (context, services) => {
          const itemCount = services.mapPins.getUnpinnedMapItems(context).length
          return itemCount > 1 ? `Pin ${itemCount} items to Map` : 'Pin to Map'
        },
        icon: MapPin,
        group: 'pin-actions',
        priority: 2,
        applies: (context, services) =>
          selection.allSelectedItemsHaveEditAccess(context) &&
          p.inSidebar(context) &&
          p.isSidebarItem(context) &&
          services.mapPins.canEditActiveMap() &&
          services.mapPins.getUnpinnedMapItems(context).length > 0 &&
          !services.mapPins.isActiveMapItem(context.item),
      },
      {
        id: 'go-to-map-pin',
        commandId: 'goToMapPin',
        label: 'Go to Map Pin',
        icon: Navigation,
        group: 'primary',
        priority: 2,
        applies: (context, services) =>
          p.inSidebar(context) &&
          p.isSidebarItem(context) &&
          services.mapPins.isPinnedOnActiveMap(context.item) &&
          !services.mapPins.isActiveMapItem(context.item),
      },
      {
        id: 'hide-pin',
        commandId: 'togglePinVisibility',
        label: 'Hide Pin',
        icon: EyeOff,
        group: 'pin-actions',
        priority: 49,
        applies: (context, services) =>
          p.inView('map-view')(context) &&
          services.mapPins.canEditActiveMap() &&
          services.mapPins.hasPinContext() &&
          services.mapPins.getActivePinVisible() === true,
      },
      {
        id: 'show-pin',
        commandId: 'togglePinVisibility',
        label: 'Show Pin',
        icon: Eye,
        group: 'pin-actions',
        priority: 49,
        applies: (context, services) =>
          p.inView('map-view')(context) &&
          services.mapPins.canEditActiveMap() &&
          services.mapPins.hasPinContext() &&
          services.mapPins.getActivePinVisible() !== true,
      },
      {
        id: 'move-map-pin',
        commandId: 'moveMapPin',
        label: 'Move Pin',
        icon: Move,
        group: 'pin-actions',
        priority: 50,
        applies: (context, services) =>
          p.inView('map-view')(context) &&
          services.mapPins.canEditActiveMap() &&
          services.mapPins.hasPinContext(),
      },
      {
        id: 'remove-map-pin',
        commandId: 'removeMapPin',
        label: 'Remove Pin',
        icon: Trash2,
        group: 'pin-actions',
        priority: 51,
        variant: 'danger',
        applies: (context, services) =>
          p.inView('map-view')(context) &&
          services.mapPins.canEditActiveMap() &&
          services.mapPins.hasPinContext(),
      },
      {
        id: 'create-map-pin',
        commandId: 'createMapPin',
        label: 'Create Pin Here',
        icon: MapPin,
        group: 'pin-actions',
        priority: 52,
        applies: (context, services) =>
          services.mapPins.canEditActiveMap() &&
          services.mapPins.isActiveMapItem(context.item) &&
          p.inView('map-view')(context),
      },
    ],
  },
] satisfies ReadonlyArray<WorkspaceContextMenuContributor>
