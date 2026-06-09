import { EyeOff, MapPin, Move, Trash2 } from 'lucide-react'
import * as p from '../predicates'
import { createActionCommand } from './command'
import type { ContextMenuContributor, EditorContextMenuServices, EditorMenuContext } from '../types'

type EditorContextMenuContributor = ContextMenuContributor<
  EditorMenuContext,
  EditorContextMenuServices
>

function getUnpinnedMapItems(context: EditorMenuContext) {
  if (!context.activeMap) return []
  const pins = context.activeMap.pins ?? []
  const pinnedItemIds = new Set(pins.map((pin) => pin.itemId))
  return (context.selectedItems ?? []).filter(
    (item) => item._id !== context.activeMap?._id && !pinnedItemIds.has(item._id),
  )
}

export const mapPinContextMenuCommands = {
  pinToMap: createActionCommand('pinToMap', (actions, context) =>
    actions.mapPins.pinToMap(context),
  ),
  goToMapPin: createActionCommand('goToMapPin', (actions, context) =>
    actions.mapPins.goToMapPin(context),
  ),
  createMapPin: createActionCommand('createMapPin', (actions, context) =>
    actions.mapPins.createMapPin(context),
  ),
  removeMapPin: createActionCommand('removeMapPin', (actions, context) =>
    actions.mapPins.removeMapPin(context),
  ),
  moveMapPin: createActionCommand('moveMapPin', (actions, context) =>
    actions.mapPins.moveMapPin(context),
  ),
  togglePinVisibility: createActionCommand('togglePinVisibility', (actions, context) =>
    actions.mapPins.togglePinVisibility(context),
  ),
}

export const mapPinContextMenuContributors = [
  {
    id: 'editor-pin-actions',
    surfaces: ['sidebar', 'map-view'],
    getItems: () => [
      {
        id: 'pin-to-map',
        commandId: 'pinToMap',
        label: (context) => {
          const itemCount = getUnpinnedMapItems(context).length
          return itemCount > 1 ? `Pin ${itemCount} items to Map` : 'Pin to Map'
        },
        icon: MapPin,
        group: 'pin-actions',
        priority: 1,
        applies: (context) =>
          p.allSelectedItemsHaveEditAccess(context) &&
          p.inSidebar(context) &&
          p.isSidebarItem(context) &&
          getUnpinnedMapItems(context).length > 0 &&
          p.isNotActiveMap(context),
      },
      {
        id: 'toggle-pin-visibility',
        commandId: 'togglePinVisibility',
        label: (context) => (context.activePin?.visible === true ? 'Hide Pin' : 'Show Pin'),
        icon: EyeOff,
        group: 'pin-actions',
        priority: 49,
        applies: (context) => p.isDm(context) && p.hasPinContext(context),
      },
      {
        id: 'move-map-pin',
        commandId: 'moveMapPin',
        label: 'Move Pin',
        icon: Move,
        group: 'pin-actions',
        priority: 50,
        applies: (context) => p.hasEditAccess(context) && p.hasPinContext(context),
      },
      {
        id: 'remove-map-pin',
        commandId: 'removeMapPin',
        label: 'Remove Pin',
        icon: Trash2,
        group: 'pin-actions',
        priority: 51,
        variant: 'danger',
        applies: (context) => p.hasEditAccess(context) && p.hasPinContext(context),
      },
      {
        id: 'create-map-pin',
        commandId: 'createMapPin',
        label: 'Create Pin Here',
        icon: MapPin,
        group: 'pin-actions',
        priority: 52,
        applies: (context) =>
          p.hasEditAccess(context) && p.isActiveMap(context) && p.inView('map-view')(context),
      },
    ],
  },
] satisfies ReadonlyArray<EditorContextMenuContributor>
